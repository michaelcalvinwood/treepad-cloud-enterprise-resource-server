exports.createUpdatesTable = `CREATE TABLE IF NOT EXISTS updates (
    user_id BIGINT NOT NULL,
    trees_ts BIGINT NOT NULL DEFAULT 0,
    branches_ts BIGINT NOT NULL DEFAULT 0,
    tree_order text DEFAULT '[]',
    PRIMARY KEY(user_id)
)`;

exports.createTreesTable = `CREATE TABLE IF NOT EXISTS trees (
    user_id BIGINT NOT NULL,
    tree_id VARCHAR(128) NOT NULL,
    icon VARCHAR(1024) NOT NULL,
    color VARCHAR(16) DEFAULT '#000000',
    tree_name VARCHAR(256) NOT NULL,
    tree_desc VARCHAR(2048),
    owner_name VARCHAR(256),
    branch_order text DEFAULT '[]',
    updated_ts BIGINT NOT NULL DEFAULT 0,
    type VARCHAR(128) DEFAULT 'private',
    tags VARCHAR(1024) NOT NULL DEFAULT '[]',
    PRIMARY KEY(tree_id),
    INDEX(user_id),
    UNIQUE(owner_name, tree_name)
)`;

exports.createBranchesTable = `CREATE TABLE IF NOT EXISTS branches (
    branch_id VARCHAR(128) NOT NULL,
    tree_id VARCHAR(128) NOT NULL,
    immutable_parent_id VARCHAR(128) NOT NULL DEFAULT '',
    branch_name VARCHAR(1024) NOT NULL DEFAULT '',
    default_module VARCHAR(128) NOT NULL DEFAULT '',
    active_modules text NOT NULL DEFAULT '[]',
    updated_ts BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY(branch_id),
    INDEX(tree_id)
)`;

exports.createModulesTable = `CREATE TABLE IF NOT EXISTS modules (
    module_name VARCHAR(128) NOT NULL,
    icon VARCHAR(512) NOT NULL,
    PRIMARY KEY(module_name)
)`;
