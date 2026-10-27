import { seedDatabase } from './seed.js';
import { db } from './db.js';

const result = seedDatabase();
if (result.skipped) {
  console.log('Database đã có dữ liệu. Xoá file server/data/xego.db nếu muốn seed lại.');
}
db.close();
