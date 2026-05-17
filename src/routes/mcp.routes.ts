import { Router } from "express";
import { mcpCorsMiddleware } from "@/middlewares/mcp-cors.middleware";
import { mcpSecurityMiddleware } from "@/middlewares/mcp-security.middleware";
import { createMcpRouter, McpServerManager } from "@/mcp";

export default (manager: McpServerManager) => {
  const router: Router = Router();

  const { handlePost, handleGet, handleDelete } = createMcpRouter(manager);

  router.use('/mcp', mcpCorsMiddleware);
  router.post('/mcp', mcpSecurityMiddleware, handlePost);
  router.get('/mcp', mcpSecurityMiddleware, handleGet);
  router.delete('/mcp', mcpSecurityMiddleware, handleDelete);

  return router;
}
