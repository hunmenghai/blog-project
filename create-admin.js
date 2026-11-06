
import pg from "pg";
import bcrypt from "bcrypt";
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const db = process.env.DATABASE_URL
  ? new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new pg.Client({
      user: "postgres",
      host: "localhost",
      database: "blog",
      password: process.env.DB_PASSWORD,
      port: 5432,
    });

const rl = readline.createInterface({ input, output });

async function createAdmin() {
  try {
    await db.connect();

    const username = (await rl.question("Enter admin username: ")).trim();
    const password = await rl.question("Enter admin password: ");

    if (!username || password.length < 8) {
      throw new Error("Username is required and password must be at least 8 characters.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.query(
      `INSERT INTO public.admins (username, password_hash)
       VALUES ($1, $2)`,
      [username, passwordHash]
    );

    console.log("Admin account created successfully!");
  } catch (error) {
    console.error("Error creating admin:", error.message);
  } finally {
    rl.close();
    await db.end();
  }
}

createAdmin();
