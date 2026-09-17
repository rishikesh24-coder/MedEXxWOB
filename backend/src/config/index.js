const environment = require('../../config/environment');
const supabase = require('../../config/supabase');
const cors = require('../../config/cors');
const abdm = require('../../config/abdm');

module.exports = {
  environment,
  ...environment,
  supabase,
  cors,
  abdm,
};
