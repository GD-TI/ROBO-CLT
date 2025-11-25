require('dotenv').config();
const pgDb = require('./src/config/database');
const sqlServer = require('./src/config/sqlserver');
const redis = require('redis');

async function testPostgreSQL() {
  try {
    console.log('🔍 Testando PostgreSQL...');
    const result = await pgDb.query('SELECT NOW() as now, version() as version');
    console.log('✅ PostgreSQL conectado com sucesso!');
    console.log(`   Hora do servidor: ${result.rows[0].now}`);
    console.log(`   Versão: ${result.rows[0].version.split(',')[0]}`);
    
    // Testar tabelas
    const tables = await pgDb.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`   Tabelas encontradas: ${tables.rows.length}`);
    tables.rows.forEach(t => console.log(`     - ${t.table_name}`));
    
  } catch (error) {
    console.error('❌ Erro ao conectar no PostgreSQL:', error.message);
  }
}

async function testSQLServer() {
  try {
    console.log('\n🔍 Testando SQL Server...');
    const result = await sqlServer.query('SELECT GETDATE() as now, @@VERSION as version');
    console.log('✅ SQL Server conectado com sucesso!');
    console.log(`   Hora do servidor: ${result.recordset[0].now}`);
    
    // Testar se a tabela CONTATOS existe
    const tableCheck = await sqlServer.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'dbo' 
      AND TABLE_NAME = 'CONTATOS'
    `);
    
    if (tableCheck.recordset[0].count > 0) {
      console.log('   ✅ Tabela SERASA.dbo.CONTATOS encontrada');
      
      // Contar registros
      const countResult = await sqlServer.query('SELECT COUNT(*) as total FROM SERASA.dbo.CONTATOS');
      console.log(`   Total de contatos: ${countResult.recordset[0].total}`);
    } else {
      console.log('   ⚠️  Tabela SERASA.dbo.CONTATOS não encontrada');
    }
    
  } catch (error) {
    console.error('❌ Erro ao conectar no SQL Server:', error.message);
    console.error('   Verifique se o SQL Server está rodando e as credenciais estão corretas');
  }
}

async function testRedis() {
  try {
    console.log('\n🔍 Testando Redis...');
    
    const redisConfig = {
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      }
    };
    
    // Adicionar senha se existir
    if (process.env.REDIS_PASSWORD) {
      redisConfig.password = process.env.REDIS_PASSWORD;
      console.log('   Usando autenticação (senha configurada)');
    }
    
    // Adicionar TLS se habilitado
    if (process.env.REDIS_TLS === 'true') {
      redisConfig.socket.tls = true;
      console.log('   Usando TLS/SSL');
    }
    
    const client = redis.createClient(redisConfig);
    
    await client.connect();
    const pong = await client.ping();
    console.log('✅ Redis conectado com sucesso!');
    console.log(`   Resposta: ${pong}`);
    console.log(`   Host: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    
    await client.quit();
    
  } catch (error) {
    console.error('❌ Erro ao conectar no Redis:', error.message);
    console.error('   Verifique:');
    console.error('   - Se o Redis está rodando e acessível');
    console.error('   - Se REDIS_HOST e REDIS_PORT estão corretos');
    console.error('   - Se REDIS_PASSWORD está configurado (se necessário)');
    console.error('   - Se sua VM está na mesma VPC (Google Cloud)');
    console.error('   - Regras de firewall permitem porta 6379');
  }
}

async function runTests() {
  console.log('=================================');
  console.log('  TESTE DE CONEXÕES DOS BANCOS  ');
  console.log('=================================\n');
  
  await testPostgreSQL();
  await testSQLServer();
  await testRedis();
  
  console.log('\n=================================');
  console.log('Testes concluídos!');
  console.log('=================================\n');
  
  process.exit(0);
}

runTests().catch(error => {
  console.error('Erro ao executar testes:', error);
  process.exit(1);
});
