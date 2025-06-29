import React, { useState, useEffect } from 'react';
import { CurrencyPair } from '../types/trading';
import { Search, TrendingUp, DollarSign, Zap, BarChart3, Coins } from 'lucide-react';

interface PairSelectorProps {
  pairs: CurrencyPair[];
  selectedPair: string;
  onPairSelect: (symbol: string) => void;
  isConnected: boolean;
}

export const PairSelector: React.FC<PairSelectorProps> = ({ 
  pairs, 
  selectedPair, 
  onPairSelect, 
  isConnected 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isOpen, setIsOpen] = useState(false);

  const categories = [
    { id: 'all', name: 'All Pairs', icon: BarChart3 },
    { id: 'major', name: 'Major Pairs', icon: TrendingUp },
    { id: 'minor', name: 'Minor Pairs', icon: DollarSign },
    { id: 'exotic', name: 'Exotic Pairs', icon: Zap },
    { id: 'commodities', name: 'Commodities', icon: BarChart3 },
    { id: 'indices', name: 'Indices', icon: TrendingUp },
    { id: 'crypto', name: 'Crypto', icon: Coins }
  ];

  const filteredPairs = pairs.filter(pair => {
    const matchesSearch = pair.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pair.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || pair.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: string) => {
    const categoryData = categories.find(cat => cat.id === category);
    const IconComponent = categoryData?.icon || BarChart3;
    return <IconComponent className="w-4 h-4" />;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      major: 'text-emerald-400',
      minor: 'text-blue-400',
      exotic: 'text-purple-400',
      commodities: 'text-yellow-400',
      indices: 'text-orange-400',
      crypto: 'text-cyan-400'
    };
    return colors[category] || 'text-gray-400';
  };

  const selectedPairData = pairs.find(pair => pair.symbol === selectedPair);

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <BarChart3 className="w-5 h-5 text-blue-400 mr-2" />
          <h2 className="text-xl font-bold text-white">Trading Pairs</h2>
        </div>
        <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
          isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${
            isConnected ? 'bg-emerald-400' : 'bg-red-400'
          }`} />
          {isConnected ? 'Live Data' : 'Demo Mode'}
        </div>
      </div>

      {/* Current Selection */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={getCategoryColor(selectedPairData?.category || 'major')}>
              {getCategoryIcon(selectedPairData?.category || 'major')}
            </div>
            <div>
              <div className="text-white font-bold text-lg">{selectedPair}</div>
              <div className="text-gray-400 text-sm">{selectedPairData?.name}</div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Change Pair
          </button>
        </div>
      </div>

      {/* Pair Selection Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Select Trading Pair</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search pairs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 mr-2" />
                    {category.name}
                  </button>
                );
              })}
            </div>

            {/* Pairs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {filteredPairs.map((pair) => (
                <button
                  key={pair.symbol}
                  onClick={() => {
                    onPairSelect(pair.symbol);
                    setIsOpen(false);
                  }}
                  className={`p-4 rounded-lg border transition-all hover:scale-105 ${
                    selectedPair === pair.symbol
                      ? 'bg-blue-500/20 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={getCategoryColor(pair.category)}>
                        {getCategoryIcon(pair.category)}
                      </div>
                      <span className="font-bold">{pair.symbol}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      pair.category === 'major' ? 'bg-emerald-500/20 text-emerald-400' :
                      pair.category === 'minor' ? 'bg-blue-500/20 text-blue-400' :
                      pair.category === 'exotic' ? 'bg-purple-500/20 text-purple-400' :
                      pair.category === 'commodities' ? 'bg-yellow-500/20 text-yellow-400' :
                      pair.category === 'indices' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-cyan-500/20 text-cyan-400'
                    }`}>
                      {pair.category}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-gray-400">{pair.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Digits: {pair.digits} | Min Lot: {pair.minLot}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {filteredPairs.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No pairs found matching your criteria</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {selectedPairData && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-medium mb-3">Pair Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Digits</span>
              <div className="text-white font-medium">{selectedPairData.digits}</div>
            </div>
            <div>
              <span className="text-gray-400">Point Size</span>
              <div className="text-white font-medium">{selectedPairData.pointSize}</div>
            </div>
            <div>
              <span className="text-gray-400">Min Lot</span>
              <div className="text-white font-medium">{selectedPairData.minLot}</div>
            </div>
            <div>
              <span className="text-gray-400">Max Lot</span>
              <div className="text-white font-medium">{selectedPairData.maxLot}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};