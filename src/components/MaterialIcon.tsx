export type MaterialIconName =
  | "home"
  | "account_tree"
  | "payments"
  | "grid_view"
  | "support_agent"
  | "folder"
  | "menu_book"
  | "settings"
  | "logout"
  | "search"
  | "notifications"
  | "dark_mode"
  | "light_mode"
  | "add"
  | "chevron_right"
  | "credit_card"
  | "chat_bubble"
  | "download"
  | "lock"
  | "menu"
  | "close"
  | "check"
  | "check_circle"
  | "trending_up"
  | "arrow_back"
  | "sync"
  | "inventory_2"
  | "shopping_cart";

export function MaterialIcon({
  name,
  className = "",
}: {
  name: MaterialIconName;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined leading-none ${className}`}
      aria-hidden
      data-icon={name}
    >
      {name}
    </span>
  );
}
