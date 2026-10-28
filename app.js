
import express from "express";
import pg from "pg";
import "dotenv/config";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const app = express();
const PORT = process.env.PORT || 3000;

// Use Neon when DATABASE_URL is configured; otherwise use local PostgreSQL.
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

app.set("views", "view");
app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Home: list all posts
app.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM public.posts ORDER BY id DESC"
    );

    const posts = result.rows.map((post) => ({
      ...post,
      contentHtml: sanitizeHtml(marked.parse(post.content)),
    }));

    res.render("index", { posts });
  } catch (error) {
    console.error("Error fetching posts:", error.message);
    res.status(500).send("Could not load blog posts. Check the server terminal.");
  }
});

// Form to create a post
app.get("/new", (req, res) => {
  res.render("create");
});

// Handle new post submission
app.post("/posts", async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.redirect("/new");
    }

    await db.query(
      "INSERT INTO public.posts (title, content) VALUES ($1, $2)",
      [title, content]
    );

    res.redirect("/");
  } catch (error) {
    console.error("Error creating post:", error.message);
    res.status(500).send("Could not create the post.");
  }
});

// Display one complete blog post
app.get("/posts/:id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM public.posts WHERE id = $1",
      [req.params.id]
    );

    const post = result.rows[0];

    if (!post) {
      return res.status(404).send("Post not found");
    }

    post.contentHtml = sanitizeHtml(marked.parse(post.content));

    res.render("post", { post });
  } catch (error) {
    console.error("Error fetching post:", error.message);
    res.status(500).send("Could not load the article.");
  }
});

// Form to edit an existing post
app.get("/posts/:id/edit", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM public.posts WHERE id = $1",
      [req.params.id]
    );

    const post = result.rows[0];

    if (!post) {
      return res.status(404).send("Post not found");
    }

    res.render("edit", { post });
  } catch (error) {
    console.error("Error loading edit form:", error.message);
    res.status(500).send("Could not load the edit form.");
  }
});

// Handle edit submission
app.post("/posts/:id/edit", async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.redirect(`/posts/${req.params.id}/edit`);
    }

    await db.query(
      "UPDATE public.posts SET title = $1, content = $2 WHERE id = $3",
      [title, content, req.params.id]
    );

    res.redirect("/");
  } catch (error) {
    console.error("Error updating post:", error.message);
    res.status(500).send("Could not update the post.");
  }
});

// Delete a post
app.post("/posts/:id/delete", async (req, res) => {
  try {
    await db.query(
      "DELETE FROM public.posts WHERE id = $1",
      [req.params.id]
    );

    res.redirect("/");
  } catch (error) {
    console.error("Error deleting post:", error.message);
    res.status(500).send("Could not delete the post.");
  }
});

// Connect first, verify the actual database, then start the server.
async function startServer() {
  try {
    await db.connect();

    const result = await db.query(`
      SELECT
        current_database() AS database,
        current_schema() AS schema,
        to_regclass('public.posts') IS NOT NULL AS posts_table_exists,
        (SELECT COUNT(*) FROM public.posts) AS total_posts
    `);

    console.log("Database connection verified:", result.rows[0]);

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database connection or startup failed:", error.message);
    process.exitCode = 1;
  }
}

startServer();
