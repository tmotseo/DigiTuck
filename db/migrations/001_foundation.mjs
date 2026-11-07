// MySQL 8.4 only. DDL auto-commits: use a fresh DB and operator recovery on failure.
export const config = { transaction: false }
const options = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci'
const timestamps = 'created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'
const states = "'PENDING','ACCEPTED','PREPARING','READY','COLLECTED','REJECTED','CANCELLED','EXPIRED'"

export async function up(db) {
  const tables = [
    `CREATE TABLE users (
      id CHAR(36) PRIMARY KEY, full_name VARCHAR(120) NOT NULL,
      normalized_email VARCHAR(254) NOT NULL UNIQUE, normalized_phone VARCHAR(16) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL, role VARCHAR(16) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
      auth_version INT NOT NULL DEFAULT 1, ${timestamps},
      CONSTRAINT ck_user_role CHECK (role IN ('CUSTOMER','VENDOR','ADMIN')),
      CONSTRAINT ck_user_status CHECK (status IN ('ACTIVE','INACTIVE')),
      CONSTRAINT ck_auth_version CHECK (auth_version >= 1)
    )`,
    `CREATE TABLE sessions (
      session_id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY,
      expires INT UNSIGNED NOT NULL, data MEDIUMTEXT COLLATE utf8mb4_bin,
      INDEX ix_session_expiry (expires)
    )`,
    `CREATE TABLE shops (
      id CHAR(36) PRIMARY KEY, owner_id CHAR(36) NOT NULL UNIQUE, slug VARCHAR(160) NOT NULL UNIQUE,
      name VARCHAR(160) NOT NULL, description TEXT, phone VARCHAR(16) NOT NULL,
      address VARCHAR(500) NOT NULL, area VARCHAR(120) NOT NULL, timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Johannesburg',
      hours_json JSON NOT NULL, approval_status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
      is_paused BOOLEAN NOT NULL DEFAULT TRUE, review_version INT NOT NULL DEFAULT 1, version INT NOT NULL DEFAULT 1,
      rejection_reason VARCHAR(1000), reviewed_by CHAR(36), reviewed_at DATETIME(3), submitted_at DATETIME(3), ${timestamps},
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT ck_shop_approval CHECK (approval_status IN ('DRAFT','PENDING','APPROVED','REJECTED','SUSPENDED')),
      CONSTRAINT ck_shop_versions CHECK (review_version >= 1 AND version >= 1),
      CONSTRAINT ck_shop_paused CHECK (is_paused IN (0,1)),
      INDEX ix_shop_discovery (approval_status, area)
    )`,
    `CREATE TABLE vendor_applications (
      id CHAR(36) PRIMARY KEY, shop_id CHAR(36) NOT NULL, submission_version INT NOT NULL,
      profile_snapshot_json JSON NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
      submitted_at DATETIME(3), reviewed_by CHAR(36), reviewed_at DATETIME(3), decision_reason VARCHAR(1000),
      UNIQUE KEY uq_application_version (shop_id, submission_version),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT ck_application_version CHECK (submission_version >= 1),
      CONSTRAINT ck_application_status CHECK (status IN ('DRAFT','PENDING','APPROVED','REJECTED')),
      CONSTRAINT ck_application_submission CHECK ((status = 'DRAFT' AND submitted_at IS NULL) OR (status <> 'DRAFT' AND submitted_at IS NOT NULL)),
      INDEX ix_application_review (status, submitted_at)
    )`,
    `CREATE TABLE vendor_documents (
      id CHAR(36) PRIMARY KEY, shop_id CHAR(36) NOT NULL, submission_version INT NOT NULL,
      type VARCHAR(80) NOT NULL, object_key VARCHAR(255) NOT NULL UNIQUE, original_name VARCHAR(255) NOT NULL,
      detected_mime VARCHAR(100) NOT NULL, bytes BIGINT NOT NULL,
      uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), superseded_at DATETIME(3),
      FOREIGN KEY (shop_id, submission_version) REFERENCES vendor_applications(shop_id, submission_version) ON DELETE RESTRICT,
      CONSTRAINT ck_document_size CHECK (bytes > 0 AND bytes <= 10485760),
      CONSTRAINT ck_document_mime CHECK (detected_mime IN ('application/pdf','image/jpeg','image/png'))
    )`,
    `CREATE TABLE categories (
      id CHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, slug VARCHAR(120) NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT ck_category_active CHECK (is_active IN (0,1))
    )`,
    `CREATE TABLE products (
      id CHAR(36) PRIMARY KEY, shop_id CHAR(36) NOT NULL, category_id CHAR(36) NOT NULL,
      name VARCHAR(160) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL,
      available_qty INT NOT NULL DEFAULT 0, low_stock_threshold INT NOT NULL DEFAULT 5,
      image_key VARCHAR(255), is_visible BOOLEAN NOT NULL DEFAULT TRUE, moderation_hidden_at DATETIME(3),
      archived_at DATETIME(3), version INT NOT NULL DEFAULT 1, ${timestamps},
      UNIQUE KEY uq_product_shop (id, shop_id),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
      CONSTRAINT ck_product_price CHECK (price > 0),
      CONSTRAINT ck_product_stock CHECK (available_qty >= 0 AND low_stock_threshold >= 0),
      CONSTRAINT ck_product_version CHECK (version >= 1),
      CONSTRAINT ck_product_visible CHECK (is_visible IN (0,1)),
      INDEX ix_product_catalogue (shop_id, category_id, is_visible, archived_at)
    )`,
    `CREATE TABLE orders (
      id CHAR(36) PRIMARY KEY, reference VARCHAR(32) COLLATE utf8mb4_bin NOT NULL UNIQUE,
      customer_id CHAR(36) NOT NULL, shop_id CHAR(36) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
      total_amount DECIMAL(10,2) NOT NULL, currency CHAR(3) COLLATE utf8mb4_bin NOT NULL DEFAULT 'ZAR', notes VARCHAR(500),
      shop_name_snapshot VARCHAR(160) NOT NULL, pickup_address_snapshot VARCHAR(500) NOT NULL,
      expires_at DATETIME(3) NOT NULL, collected_at DATETIME(3), version INT NOT NULL DEFAULT 1, ${timestamps},
      UNIQUE KEY uq_order_shop (id, shop_id),
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT,
      CONSTRAINT ck_order_status CHECK (status IN (${states})),
      CONSTRAINT ck_order_amount CHECK (total_amount > 0),
      CONSTRAINT ck_order_currency CHECK (currency = 'ZAR'),
      CONSTRAINT ck_order_version CHECK (version >= 1),
      CONSTRAINT ck_order_collected CHECK ((status = 'COLLECTED' AND collected_at IS NOT NULL) OR (status <> 'COLLECTED' AND collected_at IS NULL)),
      INDEX ix_order_customer (customer_id, created_at), INDEX ix_order_queue (shop_id, status, created_at), INDEX ix_order_expiry (status, expires_at)
    )`,
    `CREATE TABLE order_items (
      id CHAR(36) PRIMARY KEY, order_id CHAR(36) NOT NULL, product_id CHAR(36) NOT NULL, shop_id CHAR(36) NOT NULL,
      name_snapshot VARCHAR(160) NOT NULL, unit_price DECIMAL(10,2) NOT NULL, quantity INT NOT NULL,
      line_total DECIMAL(10,2) NOT NULL, restocked_qty INT NOT NULL DEFAULT 0, written_off_qty INT NOT NULL DEFAULT 0,
      UNIQUE KEY uq_order_product (order_id, product_id),
      FOREIGN KEY (order_id, shop_id) REFERENCES orders(id, shop_id) ON DELETE RESTRICT,
      FOREIGN KEY (product_id, shop_id) REFERENCES products(id, shop_id) ON DELETE RESTRICT,
      CONSTRAINT ck_item_quantity CHECK (quantity BETWEEN 1 AND 99),
      CONSTRAINT ck_item_price CHECK (unit_price > 0 AND line_total = unit_price * quantity),
      CONSTRAINT ck_item_disposition CHECK (restocked_qty >= 0 AND written_off_qty >= 0 AND restocked_qty + written_off_qty <= quantity)
    )`,
    `CREATE TABLE order_events (
      id CHAR(36) PRIMARY KEY, order_id CHAR(36) NOT NULL, actor_id CHAR(36),
      from_status VARCHAR(16), to_status VARCHAR(16) NOT NULL, reason VARCHAR(1000), restock_detail_json JSON,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT ck_event_from CHECK (from_status IS NULL OR from_status IN (${states})),
      CONSTRAINT ck_event_to CHECK (to_status IN (${states})), INDEX ix_order_event_time (order_id, created_at)
    )`,
    `CREATE TABLE inventory_movements (
      id CHAR(36) PRIMARY KEY, product_id CHAR(36) NOT NULL, order_id CHAR(36), actor_id CHAR(36),
      type VARCHAR(16) NOT NULL, quantity_delta INT NOT NULL, available_after INT NOT NULL, reason VARCHAR(1000) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE KEY uq_order_movement (order_id, product_id, type),
      CONSTRAINT ck_movement_type CHECK (type IN ('RESERVE','RELEASE','ADJUST')),
      CONSTRAINT ck_movement_stock CHECK (available_after >= 0),
      CONSTRAINT ck_movement_sign CHECK ((type = 'RESERVE' AND quantity_delta < 0 AND order_id IS NOT NULL) OR (type = 'RELEASE' AND quantity_delta > 0 AND order_id IS NOT NULL) OR (type = 'ADJUST' AND quantity_delta <> 0 AND order_id IS NULL)),
      INDEX ix_product_movement (product_id, created_at)
    )`,
    `CREATE TABLE idempotency_requests (
      id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, operation VARCHAR(80) COLLATE utf8mb4_bin NOT NULL,
      request_key VARCHAR(128) COLLATE utf8mb4_bin NOT NULL, request_hash CHAR(64) COLLATE utf8mb4_bin NOT NULL,
      resource_id CHAR(36), response_status INT, response_json JSON,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), expires_at DATETIME(3),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE KEY uq_idempotency (user_id, operation, request_key),
      CONSTRAINT ck_response_status CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
      INDEX ix_idempotency_expiry (expires_at)
    )`,
    `CREATE TABLE audit_events (
      id CHAR(36) PRIMARY KEY, actor_id CHAR(36), action VARCHAR(80) NOT NULL, entity_type VARCHAR(80) NOT NULL,
      entity_id CHAR(36) NOT NULL, safe_metadata_json JSON,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX ix_audit_entity (entity_type, entity_id, created_at), INDEX ix_audit_actor (actor_id, created_at)
    )`,
    `CREATE TABLE auth_rate_limits (
      hashed_account_key CHAR(64) COLLATE utf8mb4_bin NOT NULL, hashed_ip_key CHAR(64) COLLATE utf8mb4_bin NOT NULL,
      window_start DATETIME(3) NOT NULL, failure_count INT NOT NULL DEFAULT 0, blocked_until DATETIME(3),
      PRIMARY KEY (hashed_account_key, hashed_ip_key, window_start),
      CONSTRAINT ck_failure_count CHECK (failure_count >= 0), INDEX ix_rate_expiry (blocked_until, window_start)
    )`
  ]
  for (const sql of tables) await db.raw(`${sql} ${options}`)

  for (const table of ['order_events', 'audit_events', 'inventory_movements']) {
    for (const operation of ['UPDATE', 'DELETE']) {
      await db.raw(`CREATE TRIGGER ${table}_${operation.toLowerCase()} BEFORE ${operation} ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'History is append-only'`)
    }
  }
  await db.raw(`CREATE TRIGGER application_freeze BEFORE UPDATE ON vendor_applications FOR EACH ROW
    BEGIN
      IF OLD.submitted_at IS NOT NULL AND (
        NOT (NEW.id <=> OLD.id) OR NOT (NEW.shop_id <=> OLD.shop_id) OR NOT (NEW.submission_version <=> OLD.submission_version)
        OR NOT (NEW.profile_snapshot_json <=> OLD.profile_snapshot_json) OR NOT (NEW.submitted_at <=> OLD.submitted_at) OR NEW.status = 'DRAFT'
      ) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submitted application is immutable'; END IF;
    END`)
  await db.raw(`CREATE TRIGGER application_delete BEFORE DELETE ON vendor_applications FOR EACH ROW
    BEGIN IF OLD.submitted_at IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submitted application cannot be deleted'; END IF; END`)
  for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
    const row = operation === 'INSERT' ? 'NEW' : 'OLD'
    await db.raw(`CREATE TRIGGER document_${operation.toLowerCase()} BEFORE ${operation} ON vendor_documents FOR EACH ROW
      BEGIN
        DECLARE submitted DATETIME(3);
        SELECT submitted_at INTO submitted FROM vendor_applications WHERE shop_id = ${row}.shop_id AND submission_version = ${row}.submission_version FOR UPDATE;
        IF submitted IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Submitted documents are immutable'; END IF;
        ${operation === 'UPDATE' ? "IF NOT (NEW.shop_id <=> OLD.shop_id) OR NOT (NEW.submission_version <=> OLD.submission_version) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document application cannot change'; END IF;" : ''}
      END`)
  }
  const frozen = {
    orders: ['id', 'reference', 'customer_id', 'shop_id', 'total_amount', 'currency', 'notes', 'shop_name_snapshot', 'pickup_address_snapshot', 'expires_at', 'created_at'],
    order_items: ['id', 'order_id', 'product_id', 'shop_id', 'name_snapshot', 'unit_price', 'quantity', 'line_total']
  }
  for (const [table, columns] of Object.entries(frozen)) {
    await db.raw(`CREATE TRIGGER ${table}_snapshot BEFORE UPDATE ON ${table} FOR EACH ROW BEGIN
      IF ${columns.map(column => `NOT (NEW.${column} <=> OLD.${column})`).join(' OR ')} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order snapshot is immutable'; END IF; END`)
    await db.raw(`CREATE TRIGGER ${table}_delete BEFORE DELETE ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order history cannot be deleted'`)
  }
}

export async function down(db) {
  // Dropping tables removes their triggers. Never run this against business data.
  for (const table of ['auth_rate_limits', 'audit_events', 'idempotency_requests', 'inventory_movements', 'order_events', 'order_items', 'orders', 'products', 'categories', 'vendor_documents', 'vendor_applications', 'shops', 'sessions', 'users']) {
    await db.schema.dropTableIfExists(table)
  }
}
