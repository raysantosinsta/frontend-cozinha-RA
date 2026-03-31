import React, { useState, useEffect } from "react";

interface OrderItem {
  id: string | number;
  productName: string;
  quantity: number;
  productPrice: number;
  observation?: string;
}

interface GroupedOrder {
  id: string;
  tableNumber: number;
  status: string;
  items: OrderItem[];
  createdAt: string;
  total: number;
  elapsedTime?: number;
}

interface OrderCardProps {
  order: GroupedOrder;
  onStatusChange?: () => void;
  buttonText?: string;
  buttonColor?: string;
  isReady?: boolean;
  isDarkMode?: boolean;
  showTimer?: boolean;
}

const OrderCard = ({
  order,
  onStatusChange,
  buttonText,
  buttonColor,
  isReady,
  isDarkMode = false,
  showTimer = false,
}: OrderCardProps) => {
  const [elapsedTime, setElapsedTime] = useState(order.elapsedTime || 0);

  useEffect(() => {
    if (!showTimer) return;

    const interval = setInterval(() => {
      const created = new Date(order.createdAt).getTime();
      const now = new Date().getTime();
      setElapsedTime(Math.floor((now - created) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [order.createdAt, showTimer]);

  const formatTime = (date: string | undefined) => {
    if (!date) return "--:--";
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isUrgent = (elapsedTime || 0) > 300;

  return (
    <div
      className={`relative rounded-2xl shadow-lg p-4 transition-all duration-300 animate-fadeIn
      ${isReady ? "border-l-4 border-green-500" : isUrgent ? "border-l-4 border-red-500" : ""}
      ${isDarkMode ? "bg-slate-700 hover:bg-slate-600" : "bg-white hover:shadow-xl"}
      ${isReady ? (isDarkMode ? "bg-green-900/20" : "bg-green-50") : ""}
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${isDarkMode ? "text-orange-400" : "text-orange-600"}`}>
            Mesa {order.tableNumber}
          </span>
          {isUrgent && !isReady && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
              ⚠️ URGENTE
            </span>
          )}
        </div>
        <div className="text-right">
          <div className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            {formatTime(order.createdAt)}
          </div>
          {showTimer && order.status !== "ready" && (
            <div className={`text-xs font-mono ${isUrgent ? "text-red-500 font-bold" : "text-gray-400"}`}>
              ⌛ {formatElapsedTime(elapsedTime)}
            </div>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="mb-3 space-y-2 max-h-48 overflow-y-auto">
        {order.items.map((item, idx) => (
          <div key={idx} className={`border-b pb-2 last:border-0 ${isDarkMode ? "border-gray-600" : "border-gray-100"}`}>
            <div className="flex justify-between items-center">
              <div>
                <span className={`font-medium ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                  {item.productName}
                </span>
                <span className={`ml-2 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                  x{item.quantity}
                </span>
              </div>
              <span className={`font-medium ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
                R$ {(item.productPrice * item.quantity).toFixed(2)}
              </span>
            </div>
            {item.observation && (
              <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                <i className="fas fa-pen mr-1"></i> {item.observation}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Total */}
      <div className={`mt-3 pt-3 border-t ${isDarkMode ? "border-gray-600" : "border-gray-200"}`}>
        <div className="flex justify-between items-center">
          <span className={`font-bold ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
            TOTAL DO PEDIDO
          </span>
          <span className={`text-xl font-bold ${isDarkMode ? "text-orange-400" : "text-green-600"}`}>
            R$ {order.total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Button */}
      {onStatusChange && (
        <button
          className={`w-full py-3 rounded-xl text-white font-semibold mt-4 transition-all transform hover:scale-[1.02] active:scale-95`}
          style={{ backgroundColor: buttonColor }}
          onClick={onStatusChange}
        >
          <i className={`fas ${buttonText?.includes("Iniciar") ? "fa-play" : "fa-check-circle"} mr-2`}></i>
          {buttonText}
        </button>
      )}

      {/* Ready Badge */}
      {isReady && (
        <div className="absolute -top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-bounce">
          🎉 PRONTO PARA ENTREGAR 🎉
        </div>
      )}
    </div>
  );
};

export default OrderCard;