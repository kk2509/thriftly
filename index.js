import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

// ──────────────────────
// PostgreSQL Connection
// ──────────────────────
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

db.connect();

// ──────────────────────
// Middleware
// ──────────────────────
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
  secret: "yourSecretKey",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});



// ──────────────────────
// Google OAuth
// ──────────────────────
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE google_id = $1", [profile.id]);
    if (result.rows.length === 0) {
      await db.query("INSERT INTO users (google_id, name) VALUES ($1, $2)", [profile.id, profile.displayName]);
    }
    return done(null, { id: profile.id, name: profile.displayName });
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE google_id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

// ──────────────────────
// Routes
// ──────────────────────

// Home page – Show products


app.get("/", async (req, res) => {
  try {
    const allProducts = await db.query("SELECT * FROM products ORDER BY created_at DESC");

    let favoriteProductIds = [];
    if (req.user) {
      const favs = await db.query("SELECT product_id FROM favorites WHERE user_id = $1", [req.user.google_id]);
      favoriteProductIds = favs.rows.map(f => f.product_id);
    }

    const products = allProducts.rows.map(prod => ({
      ...prod,
      is_favorite: favoriteProductIds.includes(prod.id),
    }));

    res.render("index", { products });
  } catch (err) {
    console.error("Home error:", err);
    res.status(500).send("Something went wrong.");
  }
});

//categories 
app.get("/category/:name", async (req, res) => {
  const category = req.params.name;
  try {
    const result = await db.query("SELECT * FROM products WHERE category = $1", [category]);
    res.render("index", { products: result.rows });
  } catch (err) {
    console.error("Error loading category:", err);
    res.status(500).send("Error loading products by category.");
  }
});


// Favorites
app.get("/favorites", async (req, res) => {
  if (!req.user) return res.redirect("/auth/google");

  try {
    const favs = await db.query(
      "SELECT p.* FROM favorites f JOIN products p ON f.product_id = p.id WHERE f.user_id = $1",
      [req.user.google_id]
    );
    res.render("favorites", { products: favs.rows });
  } catch (err) {
    console.error("Favorites fetch error:", err);
    res.status(500).send("Error loading favorites");
  }
});


app.post("/favorites/toggle", async (req, res) => {
  if (!req.user) return res.redirect("/auth/google");

  const userId = req.user.google_id;
  const productId = req.body.productId;

  try {
    const existing = await db.query(
      "SELECT * FROM favorites WHERE user_id = $1 AND product_id = $2",
      [userId, productId]
    );

    if (existing.rows.length > 0) {
      // Remove favorite
      await db.query(
        "DELETE FROM favorites WHERE user_id = $1 AND product_id = $2",
        [userId, productId]
      );
    } else {
      // Add favorite
      await db.query(
        "INSERT INTO favorites (user_id, product_id) VALUES ($1, $2)",
        [userId, productId]
      );
    }

    res.redirect("back");
  } catch (err) {
    console.error("Favorite toggle error:", err);
    res.status(500).send("Something went wrong.");
  }
});
app.get("/favorites/back", (req, res) => {
  res.redirect("/favorites");
});



// Cart
// Add to Cart
app.post("/cart/add", async (req, res) => {
  if (!req.user) return res.redirect("/auth/google");

  const { productId } = req.body;
  const quantity = parseInt(req.body.quantity) || 1;

  try {
    await db.query(`
      INSERT INTO cart (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id)
      DO UPDATE SET quantity = cart.quantity + $3
    `, [req.user.google_id, productId, quantity]);

    res.redirect("/cart");
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).send("Could not add to cart.");
  }
});

// View Cart
app.get("/cart", async (req, res) => {
  if (!req.user) return res.redirect("/auth/google");

  try {
    const result = await db.query(`
      SELECT p.*, c.quantity 
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1
    `, [req.user.google_id]);

    res.render("cart", { items: result.rows });
  } catch (err) {
    console.error("Cart fetch error:", err);
    res.status(500).send("Failed to load cart.");
  }
});



// Search
app.get("/search", async (req, res) => {
  const keyword = req.query.q || "";

  try {
    const result = await db.query(
      "SELECT * FROM products WHERE LOWER(name) LIKE LOWER($1) OR LOWER(description) LIKE LOWER($1)",
      [`%${keyword}%`]
    );

    res.render("search", { products: result.rows, keyword });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).send("Internal Server Error");
  }
});


// Authentication
app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => res.redirect("/")
);
app.get("/logout", (req, res) => {
  req.logout(err => {
    if (err) return console.log(err);
    res.redirect("/");
  });
});

//payment gateway

//RAZORPAY

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// app.post("/checkout", (req, res) => {
//   // Integrate Stripe, Razorpay, or just show confirmation
//   res.send("🧾 Payment process coming soon!");
// });

app.get("/checkout", async (req, res) => {
  if (!req.user) return res.redirect("/auth/google");

  try {
    const cartResult = await db.query(
      "SELECT p.price, c.quantity FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = $1",
      [req.user.google_id]
    );

    const totalAmount = cartResult.rows.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const options = {
      amount: totalAmount * 100, // in paise
      currency: "INR",
      receipt: "receipt_order_" + Math.random().toString(36).substring(2),
    };

    const order = await razorpay.orders.create(options);

    res.render("payment", {
      key: process.env.RAZORPAY_KEY_ID,
      amount: totalAmount * 100,
      order_id: order.id,
      name: req.user.name,
    });

  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).send("Checkout failed.");
  }
});



// ──────────────────────
// Server Start
// ──────────────────────
app.listen(port, () => {
  console.log(`🛍️ Thrift Store server running at http://localhost:${port}`);
});

