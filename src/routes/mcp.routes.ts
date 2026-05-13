import { Router } from "express";
import { mcpSecurityMiddleware } from "@/middlewares";
import { createMcpRouter, McpServerManager } from "@/mcp";

export default (manager: McpServerManager) => {
  const router: Router = Router();

  const { handlePost, handleGet, handleDelete } = createMcpRouter(manager);

  router.post('/mcp', mcpSecurityMiddleware, handlePost);
  router.get('/mcp', mcpSecurityMiddleware, handleGet);
  router.delete('/mcp', mcpSecurityMiddleware, handleDelete);

  return router;
}
