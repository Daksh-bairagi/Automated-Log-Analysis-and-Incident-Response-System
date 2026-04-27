const { ValidationError } = require('../utils/errors');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    if (!schema) return next();

    const payload = req[source] || {};

    for (const [key, rules] of Object.entries(schema)) {
      const value = payload[key];

      if (rules.required && (value === undefined || value === null || value === '')) {
        throw new ValidationError(`Missing required field: ${key}`);
      }

      if (value === undefined || value === null) {
        continue;
      }

      if (rules.type && !matchesType(value, rules.type)) {
        throw new ValidationError(`Invalid field type for ${key}: expected ${rules.type}`);
      }

      if (rules.arrayOf) {
        if (!Array.isArray(value)) {
          throw new ValidationError(`Invalid field type for ${key}: expected array`);
        }

        const invalidIndex = value.findIndex((item) => !matchesType(item, rules.arrayOf));
        if (invalidIndex !== -1) {
          throw new ValidationError(`Invalid item type for ${key}[${invalidIndex}]`);
        }
      }

      if (typeof rules.validate === 'function') {
        const validationResult = rules.validate(value, payload, req);
        if (validationResult === false) {
          throw new ValidationError(`Invalid value for field: ${key}`);
        }
        if (typeof validationResult === 'string') {
          throw new ValidationError(validationResult);
        }
      }
    }
    next();
  };
}

function matchesType(value, expectedType) {
  if (expectedType === 'array') {
    return Array.isArray(value);
  }

  if (expectedType === 'object') {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  return typeof value === expectedType;
}

module.exports = validate;
