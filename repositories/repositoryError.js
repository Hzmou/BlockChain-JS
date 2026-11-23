/**
 *
 *  Module to prevent raw database errors from being scattered throughout
 *  the application while preserving the original error for debugging.
 */



/**
 * Create an error with repository context while preserving the original cause.
 *
 * @param {string} operation - The database operation that failed.
 * @param {Error} cause - The original database error.
 * @returns {Error} A contextual repository error.
 */
function createRepositoryError(operation, cause) {
  return new Error(`Repository operation failed: ${operation}`, {
    cause,
  });
}

module.exports = {
  createRepositoryError,
};
