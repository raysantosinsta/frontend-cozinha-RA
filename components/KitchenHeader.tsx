import React from 'react';

interface KitchenHeaderProps {
  restaurantName?: string;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  orderCount?: number;
}

const KitchenHeader = ({
  restaurantName = "Cozinha Digital",
  soundEnabled = true,
  onToggleSound,
  orderCount = 0
}: KitchenHeaderProps) => {
  return (
    <header className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="text-4xl">🍳</div>
            <div>
              <h1 className="text-3xl font-bold">{restaurantName}</h1>
              <p className="text-orange-100 text-sm">Pedidos em tempo real</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{orderCount}</div>
              <div className="text-xs text-orange-100">Pedidos ativos</div>
            </div>
            
            <button
              onClick={onToggleSound}
              className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-all"
              aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default KitchenHeader;