import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface VATCalculation {
  id: string;
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  date: string;
}

const VAT_RATES = [
  { label: 'TVA 20%', value: '20' },
  { label: 'TVA 10%', value: '10' },
  { label: 'TVA 5.5%', value: '5.5' },
];

export default function VATScreen() {
  const [amount, setAmount] = useState('');
  const [vatRate, setVatRate] = useState('20');
  const [history, setHistory] = useState<VATCalculation[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem('vatHistory');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique TVA:', error);
    }
  };

  const saveHistory = async (newHistory: VATCalculation[]) => {
    try {
      await AsyncStorage.setItem('vatHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'historique TVA:', error);
    }
  };

  const calculateVAT = () => {
    const baseAmount = parseFloat(amount) || 0;
    const rate = parseFloat(vatRate) || 0;
    const vatAmount = (baseAmount * rate) / 100;
    const totalAmount = baseAmount + vatAmount;

    return {
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
    };
  };

  const saveCalculation = () => {
    const baseAmount = parseFloat(amount) || 0;
    if (baseAmount > 0) {
      const { vatAmount, totalAmount } = calculateVAT();
      const newCalculation: VATCalculation = {
        id: Date.now().toString(),
        amount: baseAmount,
        vatRate: parseFloat(vatRate),
        vatAmount: parseFloat(vatAmount),
        totalAmount: parseFloat(totalAmount),
        date: new Date().toISOString(),
      };
      const newHistory = [newCalculation, ...history].slice(0, 50); // Garder les 50 derniers calculs
      setHistory(newHistory);
      saveHistory(newHistory);
      setAmount('');
    }
  };

  const deleteCalculation = (id: string) => {
    const newHistory = history.filter(calc => calc.id !== id);
    setHistory(newHistory);
    saveHistory(newHistory);
  };

  const { vatAmount, totalAmount } = calculateVAT();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Montant HT</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Entrez le montant"
        />

        <Text style={styles.label}>Taux de TVA</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={vatRate}
            onValueChange={setVatRate}
            style={styles.picker}>
            {VAT_RATES.map((rate) => (
              <Picker.Item
                key={rate.value}
                label={rate.label}
                value={rate.value}
              />
            ))}
          </Picker>
        </View>

        <View style={styles.resultContainer}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Montant TVA:</Text>
            <Text style={styles.resultValue}>{vatAmount} €</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Montant TTC:</Text>
            <Text style={styles.resultValue}>{totalAmount} €</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={saveCalculation}>
          <Text style={styles.saveButtonText}>Sauvegarder le calcul</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Historique des calculs</Text>
        </View>
        <ScrollView style={styles.historyList}>
          {history.map((calc) => (
            <View key={calc.id} style={styles.historyItem}>
              <View style={styles.historyItemHeader}>
                <Text style={styles.historyDate}>
                  {new Date(calc.date).toLocaleString('fr-FR')}
                </Text>
                <Text style={styles.historyVatRate}>TVA {calc.vatRate}%</Text>
              </View>
              <View style={styles.historyDetails}>
                <View style={styles.historyRow}>
                  <Text style={styles.historyLabel}>HT:</Text>
                  <Text style={styles.historyValue}>{calc.amount.toFixed(2)} €</Text>
                </View>
                <View style={styles.historyRow}>
                  <Text style={styles.historyLabel}>TVA:</Text>
                  <Text style={styles.historyValue}>{calc.vatAmount.toFixed(2)} €</Text>
                </View>
                <View style={styles.historyRow}>
                  <Text style={styles.historyLabel}>TTC:</Text>
                  <Text style={styles.historyValue}>{calc.totalAmount.toFixed(2)} €</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => deleteCalculation(calc.id)}
                style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    ...Platform.select({
      ios: {
        margin: -8,
      },
    }),
  },
  resultContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 16,
    color: '#1c1c1e',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  historyList: {
    flex: 1,
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingVertical: 12,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  historyVatRate: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  historyDetails: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyLabel: {
    fontSize: 14,
    color: '#1c1c1e',
  },
  historyValue: {
    fontSize: 14,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
});