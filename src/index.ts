import * as dotevnv from "dotenv"

dotevnv.config();


import { loadExpress } from "@/services/express";
import { loadSentry } from "@/services/sentry";
import PersistedDatabase from "@/services/persisted-database";

loadSentry(); // Sentry must be loaded before Express

loadExpress();