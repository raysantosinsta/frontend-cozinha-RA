"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Socket } from "socket.io-client";
import io from "socket.io-client";
import OrderCard from "../components/OrderCard";
import KitchenHeader from "../components/KitchenHeader";
import NotificationSound from "../components/NotificationSound";
import "./globals.css";

// 🔧 CORREÇÃO: Remover a barra do final da URL
const BACKEND_URL = "https://backend-nestjs-ra.onrender.com";

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

  // Função para limpar a URL (remove barra final)
  const getCleanUrl = useCallback(() => {
    return BACKEND_URL.replace(/\/$/, "");
  }, []);

  const groupOrdersByTableAndTime = useCallback(
    (ordersList: Order[]): GroupedOrder[] => {
      const grouped = new Map<string, GroupedOrder>();

      ordersList.forEach((order) => {
        const timestamp = order.createdAt || new Date().toISOString();
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

        // 🔧 CORREÇÃO CRUCIAL: Se o pedido tem productName (é um pedido individual)
        if (order.productName) {
          // Verifica se o item já existe no grupo para não duplicar
          const existingItem = group.items.find(
            (i) => i.productName === order.productName && i.id === order.id,
          );
          if (!existingItem) {
            group.items.push({
              id: order.id,
              productName: order.productName,
              quantity: order.quantity || 1,
              productPrice: order.productPrice || 0,
              observation: order.observation,
            });
          }
        } else if (order.items) {
          // Se já tem items, adiciona todos
          group.items.push(...order.items);
        }

        group.originalOrders.push(order);

        // 🔧 CORREÇÃO CRUCIAL: Recalcula o total SOMANDO todos os itens
        group.total = group.items.reduce(
          (sum, item) => sum + item.productPrice * item.quantity,
          0,
        );

        // Atualiza status do grupo
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

  const updateOrdersState = useCallback(
    (updatedOrders: Order[]) => {
      const groupedOrders = groupOrdersByTableAndTime(updatedOrders);

      // 🔧 LOG para debug
      groupedOrders.forEach((group) => {
        console.log(
          `💰 [UPDATE] Mesa ${group.tableNumber}: total R$ ${group.total.toFixed(2)}`,
        );
      });

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
        const allOrders = [
          ...prev.pending.flatMap((g) => g.originalOrders),
          ...prev.preparing.flatMap((g) => g.originalOrders),
          ...prev.ready.flatMap((g) => g.originalOrders),
        ];

        const orderIndex = allOrders.findIndex((o) => o.id === updatedOrder.id);
        if (orderIndex !== -1) {
          allOrders[orderIndex] = updatedOrder;
        } else {
          allOrders.push(updatedOrder);
        }

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
      const cleanUrl = getCleanUrl();
      const url = `${cleanUrl}/api/orders`;

      console.log("🔍 Buscando pedidos em:", url);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: Order[] = await response.json();
      console.log("📦 Dados recebidos:", data.length, "pedidos");
      updateOrdersState(data);
    } catch (error) {
      console.error("❌ Error fetching orders:", error);
    }
  }, [getCleanUrl, updateOrdersState]);

  // Atualiza status do pedido
  const updateOrderStatus = useCallback(
    async (orderId: string | number, newStatus: string): Promise<void> => {
      try {
        const cleanUrl = getCleanUrl();
        const url = `${cleanUrl}/api/orders/${orderId}/status`;

        console.log(
          `📡 Atualizando pedido ${orderId} para status: ${newStatus}`,
        );
        console.log(`🔗 URL: ${url}`);

        const response = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (response.ok) {
          const updatedOrder: Order = await response.json();
          console.log(`✅ Pedido ${orderId} atualizado com sucesso!`);
          handleOrderUpdate(updatedOrder);

          if (newStatus === "ready") {
            try {
              const audioReady = new Audio("/sounds/order-ready.mp3");
              audioReady.volume = 0.5;
              audioReady
                .play()
                .catch((e) =>
                  console.warn("⚠️ Som não disponível:", e.message),
                );
            } catch (audioError) {
              console.log("Erro ao preparar áudio");
            }
          }
        } else {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Erro desconhecido" }));
          console.error(`❌ Erro ${response.status}:`, errorData);
          alert(
            "Erro ao atualizar status: " +
              (errorData.message || `Falha no servidor (${response.status})`),
          );
        }
      } catch (error) {
        console.error("❌ Erro ao atualizar pedido:", error);
        alert(
          `Erro de conexão com o servidor. Verifique se o backend está rodando em: ${BACKEND_URL}`,
        );
      }
    },
    [handleOrderUpdate, getCleanUrl],
  );

  // Atualiza status de um grupo de pedidos
  const updateGroupStatus = useCallback(
    async (group: GroupedOrder, newStatus: string): Promise<void> => {
      if (!group || !group.originalOrders) {
        console.error("❌ Grupo inválido ou sem pedidos");
        return;
      }

      try {
        console.log(
          `📦 Atualizando grupo da mesa ${group.tableNumber} para status: ${newStatus}`,
        );

        const promises = group.originalOrders.map((order) =>
          updateOrderStatus(order.id, newStatus),
        );

        await Promise.all(promises);
        console.log(
          `✅ Grupo da mesa ${group.tableNumber} atualizado com sucesso`,
        );
      } catch (error) {
        console.error(
          `❌ Erro ao atualizar grupo da mesa ${group.tableNumber}:`,
          error,
        );
      }
    },
    [updateOrderStatus],
  );

  // Toca som de notificação
  const playNotificationSound = useCallback((): void => {
    try {
      const audio = new Audio("/sounds/new-order.mp3");
      audio.volume = 0.5;
      audio.play().catch((error) => {
        console.warn("⚠️ Som não disponível:", error.message);
        if (navigator.vibrate) navigator.vibrate(200);
      });
    } catch (error) {
      console.error("❌ Erro ao criar áudio:", error);
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }, []);

  // Configura WebSocket
  useEffect(() => {
    const cleanUrl = getCleanUrl();
    if (!cleanUrl) {
      console.error("❌ URL do backend não definida!");
      return;
    }

    console.log("🔌 Conectando WebSocket em:", cleanUrl);

    const newSocket: Socket = io(cleanUrl, {
      query: { type: "kitchen" },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    setSocket(newSocket);
    fetchPendingOrders();

    newSocket.on("connect", () => {
      console.log("✅ WebSocket conectado com sucesso!");
    });

    newSocket.on("order-updated", (updatedOrder: Order) => {
      console.log("🔄 Pedido atualizado via WebSocket:", updatedOrder);
      handleOrderUpdate(updatedOrder);
    });

    // Evento: novo pedido
    newSocket.on("new-order", (order: Order) => {
      console.log("🆕 Novo pedido recebido:", order);

      // 🔧 CORREÇÃO: Garantir que o pedido tem os campos necessários
      const formattedOrder: Order = {
        ...order,
        // Garantir que productPrice é um número
        productPrice: Number(order.productPrice) || 0,
        // Garantir que quantity é pelo menos 1
        quantity: order.quantity || 1,
      };

      const price = formattedOrder.productPrice ?? 0;
      const quantity = formattedOrder.quantity ?? 1;
      console.log(
        `📊 Item: ${formattedOrder.productName} x${quantity} = R$ ${price * quantity}`,
      );

      setOrders((prev) => {
        const allOrders = [
          ...prev.pending.flatMap((g) => g.originalOrders),
          ...prev.preparing.flatMap((g) => g.originalOrders),
          ...prev.ready.flatMap((g) => g.originalOrders),
        ];

        const exists = allOrders.some((o) => o.id === formattedOrder.id);
        if (!exists) {
          allOrders.push(formattedOrder);
          console.log(`✅ Novo pedido ${formattedOrder.id} adicionado`);
        } else {
          console.log(
            `ℹ️ Pedido ${formattedOrder.id} já existe, ignorando duplicação`,
          );
        }

        const groupedOrders = groupOrdersByTableAndTime(allOrders);

        // 🔧 LOG para debug: mostra o total calculado
        groupedOrders.forEach((group) => {
          console.log(
            `💰 Mesa ${group.tableNumber}: total R$ ${group.total.toFixed(2)} - ${group.items.length} itens`,
          );
        });

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

    newSocket.on("connect_error", (error) => {
      console.error("❌ Erro de conexão WebSocket:", error.message);
    });

    newSocket.on("disconnect", (reason) => {
      console.log(`❌ WebSocket desconectado. Motivo: ${reason}`);
    });

    return () => {
      console.log("🔌 Desconectando WebSocket...");
      if (newSocket) {
        newSocket.disconnect();
        newSocket.close();
      }
    };
  }, [
    soundEnabled,
    fetchPendingOrders,
    handleOrderUpdate,
    groupOrdersByTableAndTime,
    playNotificationSound,
    getCleanUrl,
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
