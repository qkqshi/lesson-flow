type ConnectedPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function GoogleConnectedPage({
  searchParams,
}: ConnectedPageProps) {
  const { status } = await searchParams;
  const success = status === "success";
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  const telegramUrl = botUsername
    ? "https://t.me/" + botUsername + "?startapp=connected"
    : null;

  return (
    <main className="oauth-result">
      <div className="oauth-result__mark" aria-hidden="true">
        {success ? "✓" : "!"}
      </div>
      <p className="eyebrow">Google Calendar</p>
      <h1>{success ? "Календарь подключён" : "Не удалось подключить"}</h1>
      <p>
        {success
          ? "Можно возвращаться в Telegram — расписание обновится автоматически."
          : "Вернитесь в приложение и попробуйте подключение ещё раз."}
      </p>
      {telegramUrl ? (
        <a className="primary-button" href={telegramUrl}>
          Вернуться в Telegram
        </a>
      ) : (
        <p className="oauth-result__hint">Закройте эту вкладку и вернитесь в Telegram.</p>
      )}
    </main>
  );
}
