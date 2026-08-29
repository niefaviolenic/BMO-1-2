
import { createP9Client } from "./dist/src/p9/db/client.js";
const dbUrl = "postgresql://joy:db2a72dbe91ccaea4a3f141ab88036915640d110abd3d45100f7e7bdc0e0ac10@127.0.0.1:5432/joy";
const prisma = createP9Client({ enabled: true, databaseUrl: dbUrl });
async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'rara@gmail.com' } });
  console.log('USER:', JSON.stringify(user, null, 2));
  if (user) {
    const devices = await prisma.device.findMany({ where: { userId: user.id } });
    console.log('DEVICES:', JSON.stringify(devices, null, 2));
    const integrations = await prisma.integrationConnection.findMany({ where: { userId: user.id } });
    console.log('INTEGRATIONS:', JSON.stringify(integrations, null, 2));
  }
  const allDevices = await prisma.device.findMany();
  console.log('ALL DEVICES:', JSON.stringify(allDevices, null, 2));
}
main().finally(() => prisma.$disconnect());
