import express from "express";
import pg from "pg";
import "dotenv/config";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const app = express();
const PORT = process.env.PORT || 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "blog",
  password: process.env.DB_PASSWORD,
  port: 5432,
});
db.connect();

// Express looks for "views" by default — since your folder is "view", tell it explicitly:
app.set("views", "view");
app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true })); // needed to read form data (req.body)

// In-memory store — resets every time the server restarts
//let posts = [];

// Home: list all posts
app.get("/", async (req, res) => {
  const result = await db.query(
    "SELECT * FROM posts ORDER BY id DESC"
  );

  const posts = result.rows.map((post) => ({
    ...post,
    contentHtml: sanitizeHtml(
      marked.parse(post.content)
    ),
  }));

  res.render("index", { posts });
});

// Form to create a new post
app.get("/new", (req, res) => {
  res.render("create");
});

// Handle new post submission
app.post("/posts", async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.redirect("/new");
  }
  await db.query("INSERT INTO posts (title, content) VALUES ($1, $2)", [title, content]);
  res.redirect("/");
});

// Form to edit an existing post
app.get("/posts/:id/edit", async (req, res) => {
  
 // Display one complete blog post
app.get("/posts/:id", async (req, res) => {
  const result = await db.query(
    "SELECT * FROM posts WHERE id = $1",
    [req.params.id]
  );

  const post = result.rows[0];

  if (!post) {
    return res.status(404).send("Post not found");
  }

  post.contentHtml = sanitizeHtml(
    await marked.parse(post.content)
  );

  res.render("post", { post });
});

  // your db.query
  const result = await db.query(
    "SELECT * FROM posts WHERE id = $1", 
    [req.params.id]
  );

  // your result.rows[0]
  const post = result.rows[0];

  // your res.render
  res.render("edit", { post });
});


app.get("/posts/:id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM posts WHERE id = $1",
      [req.params.id]
    );

    const post = result.rows[0];

    if (!post) {
      return res.status(404).send("Post not found");
    }

    post.contentHtml = sanitizeHtml(
      await marked.parse(post.content)
    );

    res.render("post", { post });
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).send("Something went wrong while loading the post.");
  }
});

// Handle edit submission
app.post("/posts/:id/edit", async (req, res) => {
  const { title, content } = req.body;
  await db.query(
  "UPDATE posts SET title = $1, content = $2 WHERE id = $3",
  [title, content, req.params.id]
);
  res.redirect("/");
});

// Delete a post
app.post("/posts/:id/delete", async (req, res) => {
  await db.query("DELETE FROM posts WHERE id = $1", [req.params.id]);
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

