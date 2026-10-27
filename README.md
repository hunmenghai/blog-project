
# My Blog — Full-Stack Blog Application

A full-stack blog application built with Node.js, Express, EJS, and PostgreSQL. Create and manage blog posts through a clean, responsive interface.

## Features

- **Create posts** — Write and publish new blog articles.
- **Read articles** — Browse post previews and open individual article pages.
- **Edit posts** — Update existing article titles and content.
- **Delete posts** — Remove posts you no longer need.
- **Markdown rendering** — Format article content using Markdown.
- **HTML sanitization** — Sanitize rendered article content before displaying it.
- **Responsive design** — Browse the blog on desktop and smaller screens.

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | Web application framework |
| EJS | Server-side HTML templating |
| PostgreSQL | Relational database |
| `pg` | PostgreSQL client for Node.js |
| Bootstrap 5 | Responsive layout and UI components |
| CSS | Custom styling |
| Marked | Markdown parsing |
| sanitize-html | HTML sanitization |
| dotenv | Environment variable configuration |

## Getting Started

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/)
- [Git](https://git-scm.com/)

### 1. Clone the repository

```bash
git clone https://github.com/hunmenghai/blog-project.git
cd blog-project
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the database

Open PostgreSQL using pgAdmin or your preferred PostgreSQL client.

Create a database named:

```sql
CREATE DATABASE blog;
```

Then execute the SQL statements in `schema.sql` against the `blog` database to create the required table.

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
DB_PASSWORD=your_postgresql_password
```

Replace `your_postgresql_password` with your PostgreSQL password.

The application currently connects using the PostgreSQL user `postgres`, host `localhost`, database `blog`, and port `5432`. If your local configuration differs, update `app.js` accordingly.

**Security:** Never commit your `.env` file or publish database credentials.


### 5. Start the application

Run the application using Nodemon:

```bash
nodemon app.js
```

Nodemon automatically restarts the server when you save changes to your files.

Open the application in your browser:

http://localhost:3000

**Note:** If Nodemon is not installed globally, you can run it using:

```bash
npx nodemon app.js
```

Open the following URL in your browser:

http://localhost:3000

## Project Structure

```text
blog-project/
├── public/
│   └── styles.css
├── view/
│   ├── create.ejs
│   ├── edit.ejs
│   ├── index.ejs
│   └── post.ejs
├── .gitignore
├── app.js
├── package.json
├── package-lock.json
└── schema.sql
```

## What I Learned

Through this project, I practiced:

- Building server-side web applications with Express.js.
- Connecting Node.js applications to PostgreSQL.
- Implementing CRUD operations.
- Rendering dynamic pages using EJS.
- Handling forms and HTTP routes.
- Parsing Markdown and sanitizing HTML.
- Managing environment variables.
- Using Git and GitHub for version control.

## Future Improvements

- Add user authentication and authorization.
- Add pagination for larger collections of posts.
- Add post search and filtering.
- Improve form validation and error handling.
- Deploy the application online.

## Author

**Hun Menghai**

- GitHub: [@hunmenghai](https://github.com/hunmenghai)

---

Built as a full-stack web development project.
