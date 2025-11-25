const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.SQLSERVER_HOST,
  port: parseInt(process.env.SQLSERVER_PORT) || 1433,
  database: process.env.SQLSERVER_DATABASE,
  user: process.env.SQLSERVER_USER,
  password: process.env.SQLSERVER_PASSWORD,
  options: {
    encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

async function query(queryString, params = []) {
  try {
    const poolConnection = await getPool();
    const request = poolConnection.request();
    
    // Adicionar parâmetros se houver
    params.forEach((param, index) => {
      request.input(`param${index}`, param);
    });
    
    const result = await request.query(queryString);
    return result;
  } catch (error) {
    console.error('SQL Server query error:', error);
    throw error;
  }
}

async function getCPFData(cpfs) {
  if (!cpfs || cpfs.length === 0) {
    return [];
  }

  const placeholders = cpfs.map((_, index) => `@param${index}`).join(', ');
  const queryString = `SELECT cpf, nome, nasc, sexo FROM SERASA.dbo.CONTATOS WHERE CPF IN (${placeholders})`;

  try {
    const poolConnection = await getPool();
    const request = poolConnection.request();
    
    cpfs.forEach((cpf, index) => {
      request.input(`param${index}`, sql.VarChar(11), cpf);
    });
    
    const result = await request.query(queryString);
    return result.recordset;
  } catch (error) {
    console.error('Error fetching CPF data:', error);
    throw error;
  }
}

module.exports = {
  query,
  getCPFData,
  sql,
};
