import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const result = await pool.query("SELECT * FROM products");
  res.render("pages/home", { products: result.rows });
});

router.get("/shop", async (req, res) => {
  const result = await pool.query("SELECT * FROM products");
  res.render("pages/shop", { products: result.rows });
});

router.get("/product/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
  res.render("pages/product", { product: result.rows[0] });
});

router.post("/add-to-cart", (req, res) => {
  const { id } = req.body;
  if (!req.session.cart) req.session.cart = [];
  req.session.cart.push(id);
  res.redirect("/cart");
});

router.get("/cart", async (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.render("pages/cart", { items: [] });

  const query = `SELECT * FROM products WHERE id = ANY($1::int[])`;
  const result = await pool.query(query, [cart]);
  res.render("pages/cart", { items: result.rows });
});

export default router;
