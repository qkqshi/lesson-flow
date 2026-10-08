import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Условия использования — Teacher Planner",
  description: "Условия использования личного приложения Teacher Planner.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Условия использования"
      title="Простой договор с самим собой"
      summary="Teacher Planner создан как личный инструмент для управления уроками, а не как публичный сервис для других пользователей."
    >
      <section>
        <h2>Назначение</h2>
        <p>
          Приложение показывает события Google Calendar, позволяет управлять ими и
          отправляет ежедневную сводку в Telegram. Доступ разрешён только заранее
          указанному владельцу Telegram-аккаунта.
        </p>
      </section>

      <section>
        <h2>Подключённые сервисы</h2>
        <p>
          Для работы используются Google Calendar, Telegram, Vercel и Neon. На эти
          сервисы распространяются их собственные условия и правила обработки данных.
        </p>
      </section>

      <section>
        <h2>Ответственность</h2>
        <p>
          Приложение предоставляется как есть. Перед важным занятием рекомендуется
          проверять исходное событие в Google Calendar. Владелец отвечает за
          безопасность своих Google- и Telegram-аккаунтов.
        </p>
      </section>

      <section>
        <h2>Изменения</h2>
        <p>
          Функции и эти условия могут обновляться по мере развития личного приложения.
          Актуальная редакция всегда публикуется на этой странице.
        </p>
      </section>
    </LegalPage>
  );
}
