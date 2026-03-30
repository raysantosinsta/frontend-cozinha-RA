import React from "react";

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
}

interface OrderCardProps {
  order: GroupedOrder;
  onStatusChange?: () => void;
  buttonText?: string;
  buttonColor?: string;
  isReady?: boolean;
}

const OrderCard = ({
  order,
  onStatusChange,
  buttonText,
  buttonColor,
  isReady,
}: OrderCardProps) => {
  const formatTime = (date: string | undefined) => {
    if (!date) return "--:--";
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`relative rounded-2xl shadow-md p-4 bg-white border transition-all
      ${isReady ? "border-green-500 bg-green-50" : "border-gray-200"}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold text-lg text-gray-800">
          Mesa {order.tableNumber}
        </span>
        <span className="text-sm text-gray-500">
          {formatTime(order.createdAt)}
        </span>
      </div>

      {/* Items List */}
      <div className="mb-3 space-y-2">
        {order.items.map((item, idx) => (
          <div key={idx} className="border-b border-gray-100 pb-2 last:border-0">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium text-gray-900">{item.productName}</span>
                <span className="text-gray-600 ml-2">x{item.quantity}</span>
              </div>
              <span className="text-green-600 font-medium">
                R$ {(item.productPrice * item.quantity).toFixed(2)}
              </span>
            </div>
            {item.observation && (
              <p className="text-xs text-gray-500 mt-1">Obs: {item.observation}</p>
            )}
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="font-bold text-gray-700">TOTAL DO PEDIDO</span>
          <span className="text-xl font-bold text-green-600">
            R$ {order.total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Button */}
      {onStatusChange && (
        <button
          className="w-full py-2 rounded-xl text-white font-semibold mt-3 hover:opacity-90 transition"
          style={{ backgroundColor: buttonColor }}
          onClick={onStatusChange}
        >
          {buttonText}
        </button>
      )}

      {/* Ready Badge */}
      {isReady && (
        <div className="absolute -top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
          🎉 PRONTO PARA ENTREGAR 🎉
        </div>
      )}
    </div>
  );
};

export default OrderCard;