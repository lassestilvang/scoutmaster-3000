export default async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ status: 'ok', message: 'ScoutMaster 3000 API is running' }));
}
