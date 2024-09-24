import express, { Request, Response } from 'express';
import * as dotevnv from "dotenv"
import cors from "cors"
import helmet from "helmet"
import database from './services/database';
import Router from './routes/router'

dotevnv.config()

const app = express();

app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(cors())
app.use(helmet())

app.use('/', Router)

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // Initialize the database
  database.instance;
});