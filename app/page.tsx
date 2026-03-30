"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Socket } from "socket.io-client";
import io from "socket.io-client";
import OrderCard from "../components/OrderCard";
import KitchenHeader from "../components/KitchenHeader";
import NotificationSound from "../components/NotificationSound";
import "./globals.css";

const BACKEND_URL = "https://backend-nestjs-ra.onrender.com/";

interface OrderItem {
  id: string | number;
  productName: string;
  quantity: number;
  productPrice: number;
  observation?: string;
}

interface Order {
  id: string | number;
  status: "pending" | "preparing" | "ready";
  tableNumber: number;
  items?: OrderItem[];
  productName?: string;
  quantity?: number;
  productPrice?: number;
  observation?: string;
  createdAt?: string;
}

interface GroupedOrder {
  id: string;
  tableNumber: number;
  status: "pending" | "preparing" | "ready";
  items: OrderItem[];
  createdAt: string;
  total: number;
  originalOrders: Order[];
}

interface OrdersState {
  pending: GroupedOrder[];
  preparing: GroupedOrder[];
  ready: GroupedOrder[];
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<OrdersState>({
    pending: [],
    preparing: [],
    ready: [],
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Agrupa pedidos por mesa e timestamp
  const groupOrdersByTableAndTime = useCallback(
    (ordersList: Order[]): GroupedOrder[] => {
      const grouped = new Map<string, GroupedOrder>();

      ordersList.forEach((order) => {
        const timestamp = order.createdAt || new Date().toISOString();
        // Agrupa por mesa e minuto
        const key = `${order.tableNumber}_${Math.floor(new Date(timestamp).getTime() / 60000)}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            id: key,
            tableNumber: order.tableNumber,
            status: order.status,
            items: [],
            createdAt: timestamp,
            total: 0,
            originalOrders: [],
          });
        }

        const group = grouped.get(key)!;

        // Adiciona item ao grupo
        if (order.productName) {
          group.items.push({
            id: order.id,
            productName: order.productName,
            quantity: order.quantity || 1,
            productPrice: order.productPrice || 0,
            observation: order.observation,
          });
        } else if (order.items) {
          group.items.push(...order.items);
        }

        group.originalOrders.push(order);

        // Recalcula total CORRETAMENTE
        group.total = group.items.reduce(
          (sum, item) => sum + item.productPrice * item.quantity,
          0,
        );

        // Atualiza status do grupo baseado no status dos pedidos
        const statuses = group.originalOrders.map((o) => o.status);
        if (statuses.includes("ready")) {
          group.status = "ready";
        } else if (statuses.includes("preparing")) {
          group.status = "preparing";
        } else {
          group.status = "pending";
        }
      });

      return Array.from(grouped.values()).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
    [],
  );

  // Atualiza o estado de forma otimizada
  const updateOrdersState = useCallback(
    (updatedOrders: Order[]) => {
      const groupedOrders = groupOrdersByTableAndTime(updatedOrders);

      setOrders({
        pending: groupedOrders.filter((o) => o.status === "pending"),
        preparing: groupedOrders.filter((o) => o.status === "preparing"),
        ready: groupedOrders.filter((o) => o.status === "ready"),
      });
    },
    [groupOrdersByTableAndTime],
  );

  // Atualiza um pedido específico no estado
  const handleOrderUpdate = useCallback(
    (updatedOrder: Order) => {
      setOrders((prev) => {
        // Junta todos os pedidos
        const allOrders = [
          ...prev.pending.flatMap((g) => g.originalOrders),
          ...prev.preparing.flatMap((g) => g.originalOrders),
          ...prev.ready.flatMap((g) => g.originalOrders),
        ];

        // Atualiza o pedido na lista
        const orderIndex = allOrders.findIndex((o) => o.id === updatedOrder.id);
        if (orderIndex !== -1) {
          allOrders[orderIndex] = updatedOrder;
        } else {
          allOrders.push(updatedOrder);
        }

        // Reagrupa todos os pedidos
        const groupedOrders = groupOrdersByTableAndTime(allOrders);

        return {
          pending: groupedOrders.filter((o) => o.status === "pending"),
          preparing: groupedOrders.filter((o) => o.status === "preparing"),
          ready: groupedOrders.filter((o) => o.status === "ready"),
        };
      });
    },
    [groupOrdersByTableAndTime],
  );

  // Busca pedidos pendentes
  const fetchPendingOrders = useCallback(async (): Promise<void> => {
    try {
      console.log("🔍 Buscando pedidos em:", `${BACKEND_URL}/api/orders`);
      const response = await fetch(`${BACKEND_URL}/api/orders`);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: Order[] = await response.json();
      console.log("📦 Dados recebidos:", data.length, "pedidos");

      updateOrdersState(data);
    } catch (error) {
      console.error("❌ Error fetching orders:", error);
    }
  }, [updateOrdersState]);

  // Atualiza status do pedido
  const updateOrderStatus = useCallback(
    async (orderId: string | number, newStatus: string): Promise<void> => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/orders/${orderId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          },
        );

        if (response.ok) {
          const updatedOrder: Order = await response.json();
          handleOrderUpdate(updatedOrder);

          if (newStatus === "ready") {
            const audioReady = new Audio("/sounds/order-ready.mp3");
            audioReady
              .play()
              .catch((e) => console.error("Erro ao tocar som:", e));
          }
        } else {
          const errorData = await response.json();
          alert(
            "Erro ao atualizar status: " +
              (errorData.message || "Falha no servidor"),
          );
        }
      } catch (error) {
        console.error("Erro ao atualizar pedido:", error);
        alert("Erro de conexão com o servidor.");
      }
    },
    [handleOrderUpdate],
  );

  // Atualiza status de um grupo de pedidos
  const updateGroupStatus = useCallback(
    async (group: GroupedOrder, newStatus: string): Promise<void> => {
      // Atualiza cada pedido individual do grupo
      const promises = group.originalOrders.map((order) =>
        updateOrderStatus(order.id, newStatus),
      );
      await Promise.all(promises);
    },
    [updateOrderStatus],
  );

  const playNotificationSound = useCallback((): void => {
    const audio = new Audio("/sounds/new-order.mp3");
    audio.play().catch((error) => console.error("Error playing sound:", error));
  }, []);

  // Configura WebSocket
  useEffect(() => {
    console.log("🔌 Conectando WebSocket em:", BACKEND_URL);

    const newSocket: Socket = io(BACKEND_URL, {
      query: { type: "kitchen" },
      transports: ["websocket", "polling"],
    });

    setSocket(newSocket);
    fetchPendingOrders();

    // Evento: pedido atualizado
    newSocket.on("order-updated", (updatedOrder: Order) => {
      console.log("🔄 Pedido atualizado via WebSocket:", updatedOrder);
      handleOrderUpdate(updatedOrder);
    });

    // Evento: novo pedido
    newSocket.on("new-order", (order: Order) => {
      console.log("🆕 Novo pedido recebido:", order);

      // Atualiza o estado com o novo pedido
      setOrders((prev) => {
        const allOrders = [
          ...prev.pending.flatMap((g) => g.originalOrders),
          ...prev.preparing.flatMap((g) => g.originalOrders),
          ...prev.ready.flatMap((g) => g.originalOrders),
        ];

        // Verifica se o pedido já existe (evita duplicação)
        const exists = allOrders.some((o) => o.id === order.id);
        if (!exists) {
          allOrders.push(order);
        }

        const groupedOrders = groupOrdersByTableAndTime(allOrders);

        return {
          pending: groupedOrders.filter((o) => o.status === "pending"),
          preparing: groupedOrders.filter((o) => o.status === "preparing"),
          ready: groupedOrders.filter((o) => o.status === "ready"),
        };
      });

      if (soundEnabled) {
        playNotificationSound();
      }
    });

    return () => {
      newSocket.close();
    };
  }, [
    soundEnabled,
    fetchPendingOrders,
    handleOrderUpdate,
    groupOrdersByTableAndTime,
    playNotificationSound,
  ]);

  const totalActiveOrders = useMemo(() => {
    return orders.pending.length + orders.preparing.length;
  }, [orders.pending.length, orders.preparing.length]);

  return (
    <div className="kitchen-app min-h-screen bg-gray-100">
      <div className="fixed top-4 right-4 bg-gray-800 text-white px-3 py-1 rounded text-sm z-50">
        📡 {BACKEND_URL}
      </div>
      <NotificationSound url={BACKEND_URL} soundEnabled={soundEnabled} />
      <KitchenHeader
        restaurantName="Cozinha Digital"
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        orderCount={totalActiveOrders}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coluna de Novos Pedidos */}
          <div className="order-column">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-orange-500 text-white px-6 py-4">
                <h2 className="text-xl font-bold">📋 NOVOS PEDIDOS</h2>
                <p className="text-sm opacity-90">
                  {orders.pending.length} pedido(s)
                </p>
              </div>
              <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {orders.pending.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={() => updateGroupStatus(order, "preparing")}
                    buttonText="👨‍🍳 Iniciar Preparo"
                    buttonColor="#4CAF50"
                  />
                ))}
                {orders.pending.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    Nenhum pedido novo
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Em Preparo */}
          <div className="order-column">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-blue-500 text-white px-6 py-4">
                <h2 className="text-xl font-bold">🔥 EM PREPARO</h2>
                <p className="text-sm opacity-90">
                  {orders.preparing.length} pedido(s)
                </p>
              </div>
              <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {orders.preparing.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={() => updateGroupStatus(order, "ready")}
                    buttonText="✅ PRONTO PARA ENTREGAR"
                    buttonColor="#FF9800"
                  />
                ))}
                {orders.preparing.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    Nenhum pedido em preparo
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Prontos */}
          <div className="order-column">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-green-500 text-white px-6 py-4">
                <h2 className="text-xl font-bold">✨ PRONTOS</h2>
                <p className="text-sm opacity-90">
                  {orders.ready.length} pedido(s)
                </p>
              </div>
              <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {orders.ready.map((order) => (
                  <OrderCard key={order.id} order={order} isReady={true} />
                ))}
                {orders.ready.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    Nenhum pedido pronto
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
