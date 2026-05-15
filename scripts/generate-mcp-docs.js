const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStringLiteral(node, sourceText) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  // Handle tagged template expressions with interpolation
  // e.g., z.number().describe(`Max results (1-${MAX_LIMIT}). Default: 30`)
  if (ts.isTaggedTemplateExpression(node) && ts.isTemplateLiteral(node.template)) {
    const template = node.template;
    if (sourceText) {
      return sourceText.slice(template.getStart(), template.end);
    }
  }
  // Simple template literal without tag
  if (ts.isTemplateLiteral(node)) {
    if (!node.templateSpans.length) {
      return node.head.text || null;
    }
    if (sourceText) {
      return sourceText.slice(node.getStart(), node.end);
    }
  }
  return null;
}

function getObjectPropertyValue(obj, key) {
  const prop = obj.properties.find(
    (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key
  );
  if (prop && ts.isPropertyAssignment(prop)) return prop.initializer;
  return undefined;
}

/**
 * Find the root CallExpression in a chained call.
 * z.number().min(1).optional().describe('...')
 *  ─────────┘  ← this is the root (z.number())
 */
function findRootCall(node) {
  let current = node;
  while (current && ts.isCallExpression(current)) {
    const expr = current.expression;
    if (ts.isPropertyAccessExpression(expr) && ts.isCallExpression(expr.expression)) {
      current = expr.expression;
    } else {
      break;
    }
  }
  return current;
}

// ─── Zod Type Extraction ─────────────────────────────────────────────────────

function extractZodBaseType(rootCall) {
  if (!ts.isCallExpression(rootCall)) return 'unknown';

  const expr = rootCall.expression;
  if (!ts.isPropertyAccessExpression(expr)) return 'unknown';

  const methodName = expr.name.text;

  // z.array(z.string())
  if (methodName === 'array' && rootCall.arguments && rootCall.arguments.length > 0) {
    const inner = rootCall.arguments[0];
    if (ts.isCallExpression(inner)) {
      const innerRoot = findRootCall(inner);
      const innerType = extractZodBaseType(innerRoot);
      return `${innerType}[]`;
    }
  }

  // z.enum([...])
  if (methodName === 'enum') {
    return 'enum';
  }

  return methodName; // 'string', 'number', 'boolean', etc.
}

/**
 * Extract enum values from z.enum([...]) call.
 * Only works when the array is a literal (not a variable reference).
 */
function extractEnumValues(node) {
  let current = node;
  while (current) {
    if (ts.isCallExpression(current)) {
      const expr = current.expression;
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'enum') {
        const arg = current.arguments && current.arguments[0];
        if (arg && ts.isArrayLiteralExpression(arg)) {
          return arg.elements.filter(ts.isStringLiteral).map((e) => e.text);
        }
      }
    }
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const target = current.expression.expression;
      if (ts.isCallExpression(target)) {
        current = target;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return undefined;
}

/**
 * Walk the entire call chain and extract all metadata.
 * @param {ts.Node} paramNode
 * @param {string} sourceText
 */
function extractZodParam(paramNode, sourceText) {
  if (!ts.isCallExpression(paramNode)) return null;

  // Find the root call (e.g., z.number())
  const rootCall = findRootCall(paramNode);
  const baseType = extractZodBaseType(rootCall);
  const enumValues = extractEnumValues(rootCall);

  // Walk all calls in the chain to extract .optional(), .min(), .max(), .describe()
  let required = true;
  let description = '';
  let min = undefined;
  let max = undefined;

  let node = paramNode; // start from the last call in the chain
  while (node && ts.isCallExpression(node)) {
    const expr = node.expression;

    if (ts.isPropertyAccessExpression(expr)) {
      const methodName = expr.name.text;
      const args = node.arguments || [];

      if (methodName === 'optional') {
        required = false;
      }

      if (methodName === 'describe' && args.length > 0) {
        const desc = getStringLiteral(args[0], sourceText);
        if (desc) description = desc;
      }

      if ((methodName === 'min' || methodName === 'max') && args.length > 0) {
        const arg = args[0];
        const val = ts.isNumericLiteral(arg) ? parseFloat(arg.text) : null;
        if (val !== null) {
          if (methodName === 'min') min = val;
          if (methodName === 'max') max = val;
        }
      }
    }

    // Walk down to the next call in the chain
    if (ts.isPropertyAccessExpression(node.expression)) {
      const target = node.expression.expression;
      if (ts.isCallExpression(target)) {
        node = target;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  // Extract default from description text
  let defaultValue = undefined;
  if (description && description.includes('Default:')) {
    const match = description.match(/Default:\s*(\S+)/);
    if (match) defaultValue = match[1];
  }

  return {
    name: '', // filled later
    type: enumValues ? 'enum' : baseType,
    required,
    description,
    defaultValue,
    min,
    max,
    enumValues,
  };
}

// ─── AST Walkers ─────────────────────────────────────────────────────────────

function extractToolsFromFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const tools = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'registerTool'
    ) {
      const args = node.arguments;
      if (!args || args.length < 2) return;

      const name = getStringLiteral(args[0], source);
      if (!name) return;

      const config = args[1];
      if (!ts.isObjectLiteralExpression(config)) return;

      const titleNode = getObjectPropertyValue(config, 'title');
      const title = titleNode ? getStringLiteral(titleNode, source) || '' : '';

      const descNode = getObjectPropertyValue(config, 'description');
      const description = descNode ? getStringLiteral(descNode, source) || '' : '';

      const schemaNode = getObjectPropertyValue(config, 'inputSchema');
      const parameters = [];

      if (schemaNode && ts.isObjectLiteralExpression(schemaNode)) {
        for (const prop of schemaNode.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const paramName = ts.isIdentifier(prop.name) ? prop.name.text : '';

          const zodParam = extractZodParam(prop.initializer, source);
          if (zodParam) {
            zodParam.name = paramName;
            parameters.push(zodParam);
          }
        }
      }

      tools.push({
        name,
        title,
        description,
        parameters,
        sourceFile: path.relative(process.cwd(), filePath),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return tools;
}

function extractResourcesFromFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const resources = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'registerResource'
    ) {
      const args = node.arguments;
      if (!args || args.length < 3) return;

      const name = getStringLiteral(args[0], source);
      const uri = getStringLiteral(args[1], source);
      if (!name || !uri) return;

      const config = args[2];
      if (!ts.isObjectLiteralExpression(config)) return;

      const descNode = getObjectPropertyValue(config, 'description');
      const description = descNode ? getStringLiteral(descNode, source) || '' : '';

      const mimeNode = getObjectPropertyValue(config, 'mimeType');
      const mimeType = mimeNode ? getStringLiteral(mimeNode, source) || 'application/json' : 'application/json';

      resources.push({
        name,
        uri,
        mimeType,
        description,
        sourceFile: path.relative(process.cwd(), filePath),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return resources;
}

function extractServerInfo(serverFilePath) {
  const source = fs.readFileSync(serverFilePath, 'utf-8');
  const sourceFile = ts.createSourceFile(serverFilePath, source, ts.ScriptTarget.Latest, true);

  let instructions = '';

  function visit(node) {
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      if (
        node.expression.text === 'McpServer' &&
        node.arguments &&
        node.arguments.length >= 2
      ) {
        const configArg = node.arguments[1];
        if (ts.isObjectLiteralExpression(configArg)) {
          const instNode = getObjectPropertyValue(configArg, 'instructions');
          if (instNode) {
            instructions = getStringLiteral(instNode, source) || '';
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { instructions };
}

// ─── Markdown Generator ──────────────────────────────────────────────────────

function generateMarkdown(spec) {
  const lines = [];
  const l = (...args) => lines.push(args.join(' '));

  l('# MCP Server Documentation');
  l('');
  l(`> **Auto-generated** on ${spec.generatedAt} by \`generate-mcp-docs.js\``);
  l('> **Do not edit manually** — run `pnpm generate:mcp-docs` to regenerate.');
  l('');
  l('## Server');
  l('');
  l('| Property | Value |');
  l('|---|---|');
  l(`| **Name** | \`${spec.server.name}\` |`);
  l(`| **Version** | ${spec.server.version} |`);
  l(`| **Spec** | OpenMCP ${spec.openMCP} |`);
  l('');
  if (spec.server.instructions) {
    l('### Instructions');
    l('');
    l(spec.server.instructions);
    l('');
  }

  // ── Tools ──────────────────────────────────────────────────────────────
  l('## Tools');
  l('');
  l(`${spec.tools.length} tools available:`);
  l('');

  // Summary table
  l('| Name | Title | Description |');
  l('|---|---|---|');
  for (const tool of spec.tools) {
    const shortDesc = tool.description.length > 80 ? tool.description.slice(0, 80) + '…' : tool.description;
    l(`| \`${tool.name}\` | ${tool.title} | ${shortDesc} |`);
  }
  l('');

  // Detail per tool
  for (const tool of spec.tools) {
    l(`### \`${tool.name}\``);
    l('');
    l(`**${tool.title}**`);
    l('');
    l(tool.description);
    l('');
    l(`*Source: \`${tool.sourceFile}\`*`);
    l('');

    if (tool.parameters.length > 0) {
      l('<details>');
      l('<summary>Parameters</summary>');
      l('');
      l('| Parameter | Type | Required | Description |');
      l('|---|---|---|---|');
      for (const p of tool.parameters) {
        let typeStr = p.type;
        if (p.enumValues && p.enumValues.length > 0) {
          typeStr = p.enumValues.length <= 6
            ? p.enumValues.map((v) => `\`${v}\``).join(', ')
            : `enum (${p.enumValues.length} values)`;
        }
        const req = p.required ? 'yes' : 'no';
        const constraints = [];
        if (p.min !== undefined) constraints.push(`min: \`${p.min}\``);
        if (p.max !== undefined) constraints.push(`max: \`${p.max}\``);
        // Only add default constraint if NOT already in description
        if (p.defaultValue && !p.description.includes('Default:')) {
          constraints.push(`default: \`${p.defaultValue}\``);
        }
        const constraintStr = constraints.length > 0 ? ` — ${constraints.join(', ')}` : '';
        l(`| \`${p.name}\` | ${typeStr} | ${req} | ${p.description}${constraintStr} |`);
      }
      l('');
      l('</details>');
      l('');
    }
  }

  // ── Resources ──────────────────────────────────────────────────────────
  l('## Resources');
  l('');
  l(`${spec.resources.length} resources available:`);
  l('');
  l('| Name | URI | MIME Type | Description |');
  l('|---|---|---|---|');
  for (const res of spec.resources) {
    l(`| \`${res.name}\` | \`${res.uri}\` | ${res.mimeType} | ${res.description} |`);
  }
  l('');

  // ── Footer ─────────────────────────────────────────────────────────────
  l('---');
  l('');
  l(`*Generated on ${spec.generatedAt} from source files in \`src/mcp/\`*`);

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const root = path.resolve(__dirname, '..');
  const toolsDir = path.join(root, 'src', 'mcp', 'tools');
  const resourcesDir = path.join(root, 'src', 'mcp', 'resources');
  const serverFile = path.join(root, 'src', 'mcp', 'server.ts');
  const docsDir = path.join(root, 'docs');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

  console.log('🔍 Scanning MCP tools and resources...\n');

  // Collect all tools
  const toolFiles = fs
    .readdirSync(toolsDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && f !== 'index.ts')
    .map((f) => path.join(toolsDir, f));

  const allTools = [];
  for (const file of toolFiles) {
    const tools = extractToolsFromFile(file);
    console.log(`  📦 ${path.relative(root, file)} → ${tools.length} tool(s)`);
    allTools.push(...tools);
  }

  // Collect all resources
  const resourceFiles = fs
    .readdirSync(resourcesDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && f !== 'index.ts')
    .map((f) => path.join(resourcesDir, f));

  const allResources = [];
  for (const file of resourceFiles) {
    const resources = extractResourcesFromFile(file);
    console.log(`  📦 ${path.relative(root, file)} → ${resources.length} resource(s)`);
    allResources.push(...resources);
  }

  // Extract server info
  const { instructions } = extractServerInfo(serverFile);

  // Build spec
  const spec = {
    openMCP: '1.0.0',
    generator: 'generate-mcp-docs.js',
    generatedAt: new Date().toISOString(),
    server: {
      name: 'fuel-stations-spain-mcp',
      version: packageJson.version,
      instructions,
    },
    tools: allTools,
    resources: allResources,
  };

  // Ensure docs dir exists
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  // Write JSON spec
  const jsonPath = path.join(docsDir, 'mcp-spec.json');
  fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2) + '\n');
  console.log(`\n✅ ${path.relative(root, jsonPath)} (${spec.tools.length} tools, ${spec.resources.length} resources)`);

  // Write Markdown
  const mdPath = path.join(docsDir, 'MCP.md');
  fs.writeFileSync(mdPath, generateMarkdown(spec));
  console.log(`✅ ${path.relative(root, mdPath)}`);

  console.log('\n🎉 MCP documentation generated successfully!\n');
}

main();
