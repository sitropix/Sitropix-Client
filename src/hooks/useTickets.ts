import { useTicketsContext } from "@/context/TicketsContext";

/** Support tickets shared across My Requests + Submit Ticket flows. */
export function useTickets() {
  return useTicketsContext();
}
