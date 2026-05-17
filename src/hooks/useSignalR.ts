import { useEffect, useRef } from "react";
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import type { HubConnection } from "@microsoft/signalr";
import type { QueryClient } from "@tanstack/react-query";

interface UseSignalROptions {
  hubUrl: string;
  tournamentId: string;
  queryClient: QueryClient;
  accessToken?: string | null;
}

export function useSignalR({
  hubUrl,
  tournamentId,
  queryClient,
  accessToken,
}: UseSignalROptions) {
  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    const url = `${hubUrl}?tournamentId=${tournamentId}`;

    const builder = new HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: accessToken ? () => accessToken : undefined,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning);

    const connection = builder.build();

    connection.on("MatchUpdated", () => {
      queryClient.invalidateQueries({
        queryKey: ["matches", tournamentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["standings", tournamentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["display", tournamentId, "matches"],
      });
      queryClient.invalidateQueries({
        queryKey: ["display", tournamentId, "standings"],
      });
    });

    connection.on("TournamentUpdated", () => {
      queryClient.invalidateQueries({
        queryKey: ["tournament", tournamentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["display", tournamentId],
      });
    });

    connection.on("ScheduleUpdated", () => {
      queryClient.invalidateQueries({
        queryKey: ["schedule", tournamentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["display", tournamentId, "schedule"],
      });
    });

    connection.start().catch(() => {});

    connectionRef.current = connection;

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        connection.stop();
      }
    };
  }, [hubUrl, tournamentId, queryClient, accessToken]);

  return connectionRef;
}
