"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Socket } from "socket.io-client";
import io from "socket.io-client";
import OrderCard from "../components/OrderCard";
import KitchenHeader from "../components/KitchenHeader";
import NotificationSound from "../components/NotificationSound";
import "./globals.css";

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
  elapsedTime?: number;
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterTable, setFilterTable] = useState<string>("");
  const [filterTime, setFilterTime] = useState<string>("all");

  // Relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Função para limpar a URL
  const getCleanUrl = useCallback(() => {
    return BACKEND_URL.replace(/\/$/, "");
  }, []);

  // Calcular tempo decorrido
  const calculateElapsedTime = useCallback((createdAt: string): number => {
    const created = new Date(createdAt).getTime();
    const now = new Date().getTime();
    return Math.floor((now - created) / 1000); // segundos
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
            elapsedTime: calculateElapsedTime(timestamp),
          });
        }

        const group = grouped.get(key)!;

        if (order.productName) {
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
          group.items.push(...order.items);
        }

        group.originalOrders.push(order);
        group.total = group.items.reduce(
          (sum, item) => sum + item.productPrice * item.quantity,
          0,
        );
        group.elapsedTime = calculateElapsedTime(group.createdAt);

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
    [calculateElapsedTime],
  );

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

  const fetchPendingOrders = useCallback(async (): Promise<void> => {
    try {
      const cleanUrl = getCleanUrl();
      const url = `${cleanUrl}/api/orders`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: Order[] = await response.json();
      updateOrdersState(data);
    } catch (error) {
      console.error("❌ Error fetching orders:", error);
    }
  }, [getCleanUrl, updateOrdersState]);

  const updateOrderStatus = useCallback(
    async (orderId: string | number, newStatus: string): Promise<void> => {
      try {
        const cleanUrl = getCleanUrl();
        const url = `${cleanUrl}/api/orders/${orderId}/status`;

        const response = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (response.ok) {
          const updatedOrder: Order = await response.json();
          handleOrderUpdate(updatedOrder);
        } else {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Erro desconhecido" }));
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

  const updateGroupStatus = useCallback(
    async (group: GroupedOrder, newStatus: string): Promise<void> => {
      if (!group || !group.originalOrders) return;
      try {
        const promises = group.originalOrders.map((order) =>
          updateOrderStatus(order.id, newStatus),
        );
        await Promise.all(promises);
      } catch (error) {
        console.error(
          `❌ Erro ao atualizar grupo da mesa ${group.tableNumber}:`,
          error,
        );
      }
    },
    [updateOrderStatus],
  );

  const playNotificationSound = useCallback((): void => {
    try {
      const audio = new Audio("/sounds/new-order.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {
        if (navigator.vibrate) navigator.vibrate(200);
      });
    } catch (error) {
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }, []);

  // Filtros
  const filterOrders = useCallback(
    (orders: GroupedOrder[]) => {
      let filtered = [...orders];
      if (filterTable) {
        filtered = filtered.filter((o) => o.tableNumber.toString() === filterTable);
      }
      if (filterTime === "urgent") {
        filtered = filtered.filter((o) => (o.elapsedTime || 0) > 300);
      }
      return filtered;
    },
    [filterTable, filterTime],
  );

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const totalActiveOrders = useMemo(() => {
    return orders.pending.length + orders.preparing.length;
  }, [orders.pending.length, orders.preparing.length]);

  // WebSocket
  useEffect(() => {
    const cleanUrl = getCleanUrl();
    if (!cleanUrl) return;

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
      console.log("✅ WebSocket conectado");
    });

    newSocket.on("order-updated", (updatedOrder: Order) => {
      handleOrderUpdate(updatedOrder);
    });

    newSocket.on("new-order", (order: Order) => {
      const formattedOrder: Order = {
        ...order,
        productPrice: Number(order.productPrice) || 0,
        quantity: order.quantity || 1,
      };

      setOrders((prev) => {
        const allOrders = [
          ...prev.pending.flatMap((g) => g.originalOrders),
          ...prev.preparing.flatMap((g) => g.originalOrders),
          ...prev.ready.flatMap((g) => g.originalOrders),
        ];

        const exists = allOrders.some((o) => o.id === formattedOrder.id);
        if (!exists) {
          allOrders.push(formattedOrder);
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
      newSocket.disconnect();
    };
  }, [
    soundEnabled,
    fetchPendingOrders,
    handleOrderUpdate,
    groupOrdersByTableAndTime,
    playNotificationSound,
    getCleanUrl,
  ]);

  return (
    <div className={`kitchen-app min-h-screen transition-all duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
      {/* Header Profissional */}
      <header className={`sticky top-0 z-50 ${isDarkMode ? 'bg-slate-800' : 'bg-gradient-to-r from-orange-600 to-red-600'} text-white shadow-lg`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🍳</div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Cozinha Digital</h1>
                <p className="text-sm opacity-90">Pedidos em tempo real</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Relógio */}
              <div className="text-center bg-white/20 rounded-xl px-4 py-2">
                <div className="text-2xl font-mono font-bold">
                  {currentTime.toLocaleTimeString("pt-BR")}
                </div>
                <div className="text-xs opacity-80">
                  {currentTime.toLocaleDateString("pt-BR")}
                </div>
              </div>

              {/* Status da conexão */}
              <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
                <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-sm font-medium">
                  {socket?.connected ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Contador de pedidos ativos */}
              <div className="bg-white/20 rounded-full px-4 py-2">
                <span className="font-bold text-lg">{totalActiveOrders}</span>
                <span className="text-xs ml-1">ativos</span>
              </div>

              {/* Botões de ação */}
              <div className="flex gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-all"
                  title="Tela cheia"
                >
                  <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                </button>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-all"
                  title={isDarkMode ? "Modo claro" : "Modo escuro"}
                >
                  <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
                </button>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-all"
                >
                  {soundEnabled ? "🔊" : "🔇"}
                </button>
              </div>
            </div>
          </div>

          {/* Barra de filtros */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-white/20">
            <input
              type="text"
              placeholder="Filtrar por mesa..."
              value={filterTable}
              onChange={(e) => setFilterTable(e.target.value)}
              className="bg-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 text-sm w-32"
            />
            <select
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value)}
              className="bg-white/20 rounded-lg px-4 py-2 text-white text-sm"
            >
              <option value="all">Todos os pedidos</option>
              <option value="urgent">⚠️ Urgentes (+5min)</option>
            </select>
            <button
              onClick={() => { setFilterTable(""); setFilterTime("all"); }}
              className="bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2 text-sm transition-all"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Novos Pedidos */}
          <div className="order-column">
            <div className={`rounded-xl shadow-lg overflow-hidden border-l-4 border-orange-500 ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="bg-orange-500 text-white px-6 py-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <i className="fas fa-bell"></i> NOVOS PEDIDOS
                </h2>
                <p className="text-sm opacity-90">{filterOrders(orders.pending).length} pedido(s)</p>
              </div>
              <div className="p-4 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
                {filterOrders(orders.pending).map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={() => updateGroupStatus(order, "preparing")}
                    buttonText="👨‍🍳 Iniciar Preparo"
                    buttonColor="#F59E0B"
                    isDarkMode={isDarkMode}
                    showTimer={true}
                  />
                ))}
                {filterOrders(orders.pending).length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-check-circle text-4xl mb-2 opacity-50"></i>
                    <p>Nenhum pedido novo</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Em Preparo */}
          <div className="order-column">
            <div className={`rounded-xl shadow-lg overflow-hidden border-l-4 border-blue-500 ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="bg-blue-500 text-white px-6 py-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <i className="fas fa-fire"></i> EM PREPARO
                </h2>
                <p className="text-sm opacity-90">{filterOrders(orders.preparing).length} pedido(s)</p>
              </div>
              <div className="p-4 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
                {filterOrders(orders.preparing).map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={() => updateGroupStatus(order, "ready")}
                    buttonText="✅ PRONTO PARA ENTREGAR"
                    buttonColor="#3B82F6"
                    isDarkMode={isDarkMode}
                    showTimer={true}
                  />
                ))}
                {filterOrders(orders.preparing).length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-utensils text-4xl mb-2 opacity-50"></i>
                    <p>Nenhum pedido em preparo</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Prontos */}
          <div className="order-column">
            <div className={`rounded-xl shadow-lg overflow-hidden border-l-4 border-green-500 ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="bg-green-500 text-white px-6 py-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <i className="fas fa-check-circle"></i> PRONTOS
                </h2>
                <p className="text-sm opacity-90">{filterOrders(orders.ready).length} pedido(s)</p>
              </div>
              <div className="p-4 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
                {filterOrders(orders.ready).map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isReady={true}
                    isDarkMode={isDarkMode}
                  />
                ))}
                {filterOrders(orders.ready).length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-truck text-4xl mb-2 opacity-50"></i>
                    <p>Nenhum pedido pronto</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <NotificationSound url={BACKEND_URL} soundEnabled={soundEnabled} />
    </div>
  );
}