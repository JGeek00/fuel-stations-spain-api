import * as dotevnv from "dotenv"

dotevnv.config();


import { loadExpress } from "@/services/express";
import { loadSentry } from "@/services/sentry";

loadSentry(); // Sentry must be loaded before Express

loadExpress();