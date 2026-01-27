import * as dotevnv from "dotenv"
import { loadExpress } from "@/services/express";
import { loadSentry } from "@/services/sentry";

dotevnv.config()

loadSentry(); // Sentry must be loaded before Express

loadExpress();