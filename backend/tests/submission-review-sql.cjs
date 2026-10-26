// Isolated PostgreSQL; no live connection or store records.
const { PGlite } = require('../../.tmp/inventory-check/node_modules/@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE admins(id integer primary key,status text);
      CREATE TABLE staff(id integer primary key,name text,password text,must_change_password boolean);
      CREATE TABLE clients(LIKE staff INCLUDING ALL);
      CREATE TABLE products(id serial primary key,name text NOT NULL,description text,price numeric NOT NULL,stock integer,category text,image_url text,expiry_date date,status text,created_by integer);
      CREATE TABLE promos(id serial primary key,title text NOT NULL,description text,discount_type text,discount_value numeric,start_date timestamptz,end_date timestamptz,status text,created_by integer);
      CREATE TABLE pending_submissions(id serial primary key,type text,status text CHECK(status IN ('pending','approved','rejected')),data jsonb,submitted_by integer,admin_notes text,reviewed_at timestamptz);
      INSERT INTO admins VALUES(1,'active'); INSERT INTO staff VALUES(2,'Staff','old',false); INSERT INTO clients VALUES(3,'Client','old',false);
      GRANT USAGE ON SCHEMA public TO service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
    `);
    await db.exec(fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261018120749_atomic_submission_reviews.sql'),'utf8'));
    const review = (id, status='approved', hash=null, actor=1) => db.query('SELECT review_submission_atomic($1,$2,$3,$4,$5) result',[id,status,'Reviewed',actor,hash]);
    await db.exec('SET ROLE service_role');
    const add = async (type, data) => (await db.query("INSERT INTO pending_submissions(type,status,data,submitted_by) VALUES($1,'pending',$2,2) RETURNING id",[type,JSON.stringify(data)])).rows[0].id;
    const id = await add('product',{name:'Milk',price:20,category:'Food',stock:0});
    const outcomes = await Promise.allSettled([review(id), review(id)]);
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(outcomes.find(r=>r.status==='rejected').reason.code,'PT409');
    assert.equal((await db.query('SELECT count(*)::int n FROM products')).rows[0].n,1);
    assert.equal(outcomes.find(r=>r.status==='fulfilled').value.rows[0].result.before.status,'pending');
    const rejected = await add('product',{name:'Rejected',price:10,stock:9});
    await review(rejected,'rejected');
    assert.equal((await db.query('SELECT count(*)::int n FROM products')).rows[0].n,1);
    const invalidStock = await add('product',{name:'Legacy stock',price:10,stock:3});
    await assert.rejects(()=>review(invalidStock),{code:'PT409'});
    const unsupported = await add('walk_in_order',{});
    await assert.rejects(()=>review(unsupported),{code:'PT409'});
    await assert.rejects(()=>review(unsupported,'rejected'),{code:'PT409'});
    await assert.rejects(()=>review(invalidStock,'rejected',null,2),{code:'PT403'});
    // A failure AFTER the insert must roll back the created product as well.
    await db.exec("RESET ROLE; ALTER TABLE pending_submissions ADD CONSTRAINT fail_save CHECK(admin_notes IS DISTINCT FROM 'Reviewed' OR type <> 'promo'); SET ROLE service_role;");
    const promo = await add('promo',{title:'Rollback',discount_type:'fixed',discount_value:2,start_date:'2026-10-18',end_date:'2026-10-19'});
    await assert.rejects(()=>review(promo));
    assert.equal((await db.query('SELECT count(*)::int n FROM promos')).rows[0].n,0);
    assert.equal((await db.query('SELECT status FROM pending_submissions WHERE id=$1',[promo])).rows[0].status,'pending');
    await db.exec('RESET ROLE; ALTER TABLE pending_submissions DROP CONSTRAINT fail_save; SET ROLE service_role;');
    await review(promo);
    const promoId=(await db.query('SELECT id FROM promos')).rows[0].id;
    const promoEdit=await add('promo',{promo_id:promoId,title:'Updated promo'});
    await review(promoEdit);
    assert.equal((await db.query('SELECT count(*)::int n FROM promos')).rows[0].n,1);
    assert.equal((await db.query('SELECT title FROM promos')).rows[0].title,'Updated promo');
    const edit = await add('stock_update',{product_id:1,price:25});
    await review(edit);
    assert.equal(Number((await db.query('SELECT price FROM products WHERE id=1')).rows[0].price),25);
    const reset = await add('password_reset',{target_user_id:3});
    const hash = await require('bcryptjs').hash('Random-for-test-only',10);
    await review(reset,'approved',hash);
    assert.equal((await db.query('SELECT must_change_password FROM clients WHERE id=3')).rows[0].must_change_password,true);
    const adminReset = await add('password_reset',{target_user_id:1});
    await assert.rejects(()=>review(adminReset,'approved',hash),{code:'PT403'});
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(()=>review(invalidStock,'rejected'),{code:'42501'});
    console.log('PASS: atomic review, duplicate attempts, rejection, rollback, password reset, admin and function permissions');
  } finally { await db.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
