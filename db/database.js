const { Sequelize } = require('sequelize');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'bot-database.sqlite', // File path for the database
  logging: false, // Disable logging of SQL queries to the console
});

// Enable WAL (Write-Ahead Logging) mode for better concurrency and performance.
// This is a best practice for SQLite databases.
try {
  sequelize.query('PRAGMA journal_mode = WAL;');
  console.log('WAL mode enabled for SQLite database.');
} catch (error) {
  console.error('Failed to enable WAL mode:', error);
}

module.exports = sequelize;