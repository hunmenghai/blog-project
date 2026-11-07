import { v2 as cloudinary } from "cloudinary";
import session from "express-session";
import bcrypt from "bcrypt";
import express from "express";
import multer from "multer";
import pg from "pg";
import "dotenv/config";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import connectPgSimple from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import { csrfSync } from "csrf-sync";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const PostgresStore = connectPgSimple(session);
const PORT = process.env.PORT || 3000;

console.log(
  "SESSION_SECRET configured:",
  Boolean(process.env.SESSION_SECRET?.trim())
);

const {
  generateToken,
  csrfSynchronisedProtection,
} = csrfSync({
  getTokenFromRequest: (req) => req.body?._csrf,
});

// Connect to Neon when DATABASE_URL is available.
// Otherwise, connect to local PostgreSQL.
// Create a PostgreSQL connection pool.
const db = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  : new pg.Pool({
      user: "postgres",
      host: "localhost",
      database: "blog",
      password: process.env.DB_PASSWORD,
      port: 5432,
      max: 10,
    });

// Handle unexpected errors from idle database connections.
db.on("error", (error) => {
  console.error("Unexpected database pool error:", error.message);
});

// Configure EJS and middleware.
app.set("views", "view");
app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Configure administrator sessions.
app.set("trust proxy", 1);

app.use(
  session({
    store: new PostgresStore({
      pool: db,
      createTableIfMissing: true,
      tableName: "user_sessions",
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// Protect ordinary POST, PUT, PATCH, and DELETE requests.
app.use((req, res, next) => {
  if (req.is("multipart/form-data")) {
    return next();
  }

  csrfSynchronisedProtection(req, res, next);
});

// Make login status available to EJS templates.
app.use((req, res, next) => {
  res.locals.isAuthenticated = Boolean(req.session.adminId);
  res.locals.csrfToken = generateToken(req);
  next();
});

function isAuthenticated(req, res, next) {
  if (req.session.adminId) {
    return next();
  }

  res.redirect("/login");
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

// Configure Multer for image uploads.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Maximum 5 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WebP images are allowed."));
    }
  },
});

// Home: display all posts.
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
    res.status(500).send("Could not load blog posts.");
  }
});

// Display the administrator login page.
app.get("/login", (req, res) => {
  if (req.session.adminId) {
    return res.redirect("/");
  }

  res.render("login", { error: null });
});

// Authenticate administrator.
app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).render("login", {
        error: "Please enter your username and password.",
      });
    }

    const result = await db.query(
      "SELECT * FROM public.admins WHERE username = $1",
      [username.trim()]
    );

    const admin = result.rows[0];

    if (!admin) {
      return res.status(401).render("login", {
        error: "Invalid username or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).render("login", {
        error: "Invalid username or password.",
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        console.error("Session error:", error);
        return res.status(500).send("Could not create login session.");
      }

      req.session.adminId = admin.id;

      req.session.save((error) => {
        if (error) {
          console.error("Session save error:", error);
          return res.status(500).send("Could not save login session.");
        }

        res.redirect("/");
      });
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Login failed.");
  }
});

// Log out administrator.
app.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

// Display the new-post form.
app.get("/new", isAuthenticated, (req, res) => {
  res.render("create");
});

// Create a post and receive an optional image.
app.post("/posts", isAuthenticated, upload.single("image"), csrfSynchronisedProtection, async (req, res) => {
  try {
    const { title, content } = req.body ?? {};

    if (!title?.trim() || !content?.trim()) {
      return res.redirect("/new");
    }

    let imageUrl = null;

    // Upload the selected image to Cloudinary
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "my-blog",
            resource_type: "image",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        stream.end(req.file.buffer);
      });

      imageUrl = uploadResult.secure_url;
    }

    // Save the post and its image URL
    await db.query(
      `INSERT INTO public.posts (title, content, image_url)
       VALUES ($1, $2, $3)`,
      [title.trim(), content, imageUrl]
    );

    res.redirect("/");
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).send("Could not create post. Check the server terminal.");
  }
});

// Display one complete article.
app.get("/posts/:id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM public.posts WHERE id = $1",
      [req.params.id]
    );

    const post = result.rows[0];

    if (!post) {
      return res.status(404).send("Post not found.");
    }

    post.contentHtml = sanitizeHtml(marked.parse(post.content));

    res.render("post", { post });
  } catch (error) {
    console.error("Error fetching post:", error.message);
    res.status(500).send("Could not load the article.");
  }
});

// Display the edit form.
app.get("/posts/:id/edit", isAuthenticated , async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM public.posts WHERE id = $1",
      [req.params.id]
    );

    const post = result.rows[0];

    if (!post) {
      return res.status(404).send("Post not found.");
    }

    res.render("edit", { post });
  } catch (error) {
    console.error("Error loading edit form:", error.message);
    res.status(500).send("Could not load the edit form.");
  }
});

// Update an existing post.

// Update an existing post and optionally replace its image.
app.post(
  "/posts/:id/edit",
  isAuthenticated,
  upload.single("image"),
  csrfSynchronisedProtection,
  async (req, res) => {
    try {
      const { title, content } = req.body ?? {};
      const postId = req.params.id;

      if (!title?.trim() || !content?.trim()) {
        return res.redirect(`/posts/${postId}/edit`);
      }

      // Get the existing post.
      const existingPost = await db.query(
        "SELECT image_url FROM public.posts WHERE id = $1",
        [postId]
      );

      if (existingPost.rows.length === 0) {
        return res.status(404).send("Post not found.");
      }

      // Keep the current image unless a new one is uploaded.
      let imageUrl = existingPost.rows[0].image_url;

      // Upload a replacement image to Cloudinary.
      if (req.file) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "my-blog",
              resource_type: "image",
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );

          stream.end(req.file.buffer);
        });

        imageUrl = uploadResult.secure_url;
      }

      // Update the post in PostgreSQL.
      await db.query(
        `UPDATE public.posts
         SET title = $1, content = $2, image_url = $3
         WHERE id = $4`,
        [title.trim(), content, imageUrl, postId]
      );

      res.redirect("/");
    } catch (error) {
      console.error("Error updating post:", error);
      res.status(500).send("Could not update the post.");
    }
  }
);


// Delete a post.
app.post("/posts/:id/delete", isAuthenticated, csrfSynchronisedProtection, async (req, res) => {
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

// Connect to the database before starting the server.
async function startServer() {
  try {
    const result = await db.query(`
      SELECT
        current_database() AS database,
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
