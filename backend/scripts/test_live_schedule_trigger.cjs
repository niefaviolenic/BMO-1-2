const { PrismaClient } = require('/opt/joy/app/backend/dist/src/generated/prisma/index.js');
const { createP9Client } = require('/opt/joy/app/backend/dist/src/p9/db/client.js');

async function main() {
  const prisma = new PrismaClient();
  
  // Find recent user
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true }
  });
  
  const device = await prisma.device.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    select: { id: true, name: true, hardwareId: true }
  });

  const session = await prisma.chatSession.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true }
  });

  console.log("User:", user.id);
  console.log("Device:", device?.id, device?.name);
  console.log("Active Session:", session?.id);

  const dueAt = new Date(Date.now() - 1000); // due now!

  const schedule = await prisma.schedule.create({
    data: {
      userId: user.id,
      targetDeviceId: device?.id ?? null,
      timezone: "Asia/Jakarta",
      status: "ACTIVE",
      recurrence: {
        frequency: "Once",
        every: 1,
        date: dueAt.toISOString().split("T")[0],
        timeOfDay: "Morning",
      },
      payload: {
        prompt: "Tes Pengingat Live Berhasil",
        title: "Tes Pengingat Live Berhasil",
        sessionId: session?.id,
        deliveryTargets: ["MOBILE", "DEVICE"],
      },
      nextRunAt: dueAt,
    }
  });

  console.log("Created test schedule:", schedule.id, "dueAt:", dueAt.toISOString());

  // Wait 35s for background maintenance loop in container to run
  console.log("Waiting for scheduler worker in container...");
  await new Promise((r) => setTimeout(r, 35000));

  const run = await prisma.scheduleRun.findFirst({
    where: { scheduleId: schedule.id },
    select: { id: true, status: true, errorCode: true, completedAt: true }
  });
  console.log("ScheduleRun Result:", run);

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: session?.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, role: true, content: true, createdAt: true }
  });
  console.log("Recent Session Messages:", messages);
  
  await prisma.$disconnect();
}

main().catch(console.error);
