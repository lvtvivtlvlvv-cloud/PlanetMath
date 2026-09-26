export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { cleanupExpiredFiles } = await import("./lib/cleanup-files");
    const DAY_MS = 24 * 60 * 60 * 1000;
    setInterval(async () => {
      try {
        await cleanupExpiredFiles();
      } catch (err) {
        console.error("Cron error:", err);
      }
    }, DAY_MS);
  }
}