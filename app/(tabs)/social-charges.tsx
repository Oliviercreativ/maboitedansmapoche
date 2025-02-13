import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface SocialCharge {
  id: string;
  type: string;
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  dueDate: string;
  status: 'pending' | 'paid';
  paymentDate?: string;
}

interface Settings {
  urssafRate: number;
  isVatEnabled: boolean;
}

const CHARGE_TYPES = ['CA Mensuel', 'URSSAF'];

const VAT_RATES = [
  { label: 'Sans TVA (0%)', value: 0 },
  { label: 'TVA 5.5%', value: 5.5 },
  { label: 'TVA 10%', value: 10 },
  { label: 'TVA 20%', value: 20 },
];

const calculateAmounts = (ttcAmount: number, vatRate: number) => {
  if (vatRate === 0) {
    return {
      baseAmount: ttcAmount,
      vatAmount: 0,
      totalAmount: ttcAmount
    };
  }
  const baseAmount = ttcAmount / (1 + vatRate / 100);
  const vatAmount = ttcAmount - baseAmount;
  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalAmount: ttcAmount
  };
};

export default function SocialChargesScreen() {
  const [charges, setCharges] = useState<SocialCharge[]>([]);
  const [type, setType] = useState(CHARGE_TYPES[0]);
  const [ttcAmount, setTtcAmount] = useState('');
  const [vatRate, setVatRate] = useState(VAT_RATES[0].value);
  const [dueDate, setDueDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingCharge, setEditingCharge] = useState<SocialCharge | null>(null);
  const [totalMonthlyRevenue, setTotalMonthlyRevenue] = useState(0);
  const [settings, setSettings] = useState<Settings>({
    urssafRate: 23.1,
    isVatEnabled: false
  });
  const [calculatedAmounts, setCalculatedAmounts] = useState({
    baseAmount: 0,
    vatAmount: 0,
    totalAmount: 0
  });

  useEffect(() => {
    loadCharges();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('companySettings');
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings({
          urssafRate: parsedSettings.urssafRate || 23.1,
          isVatEnabled: parsedSettings.isVatEnabled || false
        });
        // Si pas assujetti à la TVA, on force le taux à 0
        if (!parsedSettings.isVatEnabled) {
          setVatRate(0);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
    }
  };

  const loadCharges = async () => {
    try {
      const storedCharges = await AsyncStorage.getItem('socialCharges');
      if (storedCharges) {
        const parsedCharges = JSON.parse(storedCharges);
        setCharges(parsedCharges);
        
        // Calculer le CA total
        const monthlyRevenue = parsedCharges
          .filter(charge => charge.type === 'CA Mensuel' && charge.status === 'pending')
          .reduce((sum, charge) => sum + charge.amount, 0);
        setTotalMonthlyRevenue(monthlyRevenue);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des charges sociales:', error);
      Alert.alert('Erreur', 'Impossible de charger les charges sociales');
    } finally {
      setLoading(false);
    }
  };

  const saveCharges = async (newCharges: SocialCharge[]) => {
    try {
      await AsyncStorage.setItem('socialCharges', JSON.stringify(newCharges));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des charges:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les charges');
    }
  };

  const updateAmounts = (newTtc: string, newVatRate: number) => {
    const ttc = parseFloat(newTtc);
    if (!isNaN(ttc)) {
      // Si pas assujetti à la TVA, on force le calcul avec un taux de 0
      const effectiveVatRate = settings.isVatEnabled ? newVatRate : 0;
      setCalculatedAmounts(calculateAmounts(ttc, effectiveVatRate));
    } else {
      setCalculatedAmounts({ baseAmount: 0, vatAmount: 0, totalAmount: 0 });
    }
  };

  const addOrUpdateCharge = async () => {
    if (!ttcAmount && type !== 'URSSAF') {
      Alert.alert('Erreur', 'Veuillez saisir un montant');
      return;
    }

    try {
      const newCharge: SocialCharge = {
        id: editingCharge?.id || Date.now().toString(),
        type,
        amount: calculatedAmounts.baseAmount,
        vatRate,
        vatAmount: calculatedAmounts.vatAmount,
        totalAmount: calculatedAmounts.totalAmount,
        dueDate: dueDate.toISOString(),
        status: 'pending',
      };

      let newCharges;
      if (type === 'URSSAF') {
        // Pour URSSAF, on calcule le montant basé sur le CA total
        newCharge.amount = totalMonthlyRevenue * (settings.urssafRate / 100);
        newCharge.totalAmount = newCharge.amount + newCharge.vatAmount;
      }

      newCharges = editingCharge
        ? charges.map(charge => (charge.id === editingCharge.id ? newCharge : charge))
        : [...charges, newCharge];

      if (type === 'CA Mensuel') {
        // Mettre à jour le CA total
        const newTotalRevenue = newCharges
          .filter(charge => charge.type === 'CA Mensuel' && charge.status === 'pending')
          .reduce((sum, charge) => sum + charge.amount, 0);
        setTotalMonthlyRevenue(newTotalRevenue);
      }

      setCharges(newCharges);
      await saveCharges(newCharges);

      setTtcAmount('');
      setDueDate(new Date());
      setEditingCharge(null);
      setCalculatedAmounts({ baseAmount: 0, vatAmount: 0, totalAmount: 0 });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la charge:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter la charge');
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const newCharges = charges.map(charge =>
        charge.id === id
          ? { ...charge, status: 'paid', paymentDate: new Date().toISOString() }
          : charge
      );
      setCharges(newCharges);
      await saveCharges(newCharges);

      // Mettre à jour le CA total si nécessaire
      const newTotalRevenue = newCharges
        .filter(charge => charge.type === 'CA Mensuel' && charge.status === 'pending')
        .reduce((sum, charge) => sum + charge.amount, 0);
      setTotalMonthlyRevenue(newTotalRevenue);
    } catch (error) {
      console.error('Erreur lors du marquage comme payé:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    }
  };

  const deleteCharge = async (id: string) => {
    try {
      const newCharges = charges.filter(charge => charge.id !== id);
      setCharges(newCharges);
      await saveCharges(newCharges);

      // Mettre à jour le CA total si nécessaire
      const newTotalRevenue = newCharges
        .filter(charge => charge.type === 'CA Mensuel' && charge.status === 'pending')
        .reduce((sum, charge) => sum + charge.amount, 0);
      setTotalMonthlyRevenue(newTotalRevenue);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      Alert.alert('Erreur', 'Impossible de supprimer la charge');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const totalPending = charges
    .filter(charge => charge.status === 'pending')
    .reduce((sum, charge) => {
      if (charge.type === 'CA Mensuel') {
        // Pour le CA Mensuel, on calcule 23,1% du montant HT
        return sum + (charge.amount * settings.urssafRate / 100);
      }
      return sum + charge.amount;
    }, 0);

  const totalVAT = charges
    .filter(charge => charge.status === 'pending')
    .reduce((sum, charge) => sum + charge.vatAmount, 0);

  const formationFee = totalMonthlyRevenue * 0.002;
  const totalWithFormation = totalPending + formationFee;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Type de charge</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={type}
              onValueChange={(itemValue) => setType(itemValue)}
              style={styles.picker}
              dropdownIconColor="#007AFF"
            >
              {CHARGE_TYPES.map((chargeType) => (
                <Picker.Item
                  key={chargeType}
                  label={chargeType}
                  value={chargeType}
                  style={styles.pickerItem}
                />
              ))}
            </Picker>
          </View>
        </View>

        {type !== 'URSSAF' && (
          <View>
            <TextInput
              style={styles.input}
              placeholder="Montant TTC"
              value={ttcAmount}
              onChangeText={(text) => {
                setTtcAmount(text);
                updateAmounts(text, vatRate);
              }}
              keyboardType="numeric"
            />
            {ttcAmount !== '' && (
              <View style={styles.amountsContainer}>
                <Text style={styles.amountText}>Montant HT: {calculatedAmounts.baseAmount.toFixed(2)} €</Text>
                <Text style={styles.amountText}>TVA ({vatRate}%): {calculatedAmounts.vatAmount.toFixed(2)} €</Text>
                <Text style={styles.amountText}>Total TTC: {calculatedAmounts.totalAmount.toFixed(2)} €</Text>
              </View>
            )}
          </View>
        )}

        {type !== 'URSSAF' && settings.isVatEnabled && (
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Taux de TVA</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={vatRate}
                onValueChange={(itemValue) => {
                  setVatRate(itemValue);
                  updateAmounts(ttcAmount, itemValue);
                }}
                style={styles.picker}
                dropdownIconColor="#007AFF"
              >
                {VAT_RATES.map((rate) => (
                  <Picker.Item
                    key={rate.value.toString()}
                    label={rate.label}
                    value={rate.value}
                    style={styles.pickerItem}
                  />
                ))}
              </Picker>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateButtonText}>
            Date d'échéance: {formatDate(dueDate.toISOString())}
          </Text>
          <Ionicons name="calendar-outline" size={20} color="#007AFF" />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        )}

        <TouchableOpacity style={styles.addButton} onPress={addOrUpdateCharge}>
          <Text style={styles.addButtonText}>
            {type === 'URSSAF' 
              ? 'Valider mon CA'
              : type === 'CA Mensuel'
                ? 'Ajouter un montant'
                : editingCharge 
                  ? 'Modifier la charge' 
                  : 'Ajouter une charge'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totalContainer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total CA en attente:</Text>
          <Text style={styles.totalAmount}>{totalMonthlyRevenue} €</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Total charges en attente ({settings.urssafRate}% du CA HT):
          </Text>
          <Text style={styles.totalAmount}>
            {totalPending.toFixed(2)} €
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Frais de la formation:</Text>
          <Text style={styles.totalAmount}>{formationFee} €</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total TVA à reverser:</Text>
          <Text style={styles.totalAmount}>{totalVAT.toFixed(2)} €</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total à payer (hors TVA):</Text>
          <Text style={[styles.totalAmount, styles.finalAmount]}>{totalWithFormation.toFixed(2)} €</Text>
        </View>
      </View>

      <ScrollView style={styles.chargesList}>
        {charges
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .map((charge) => (
          <View key={charge.id} style={styles.chargeItem}>
            <View style={styles.chargeInfo}>
              <Text style={styles.chargeType}>{charge.type}</Text>
              <Text style={styles.chargeAmount}>HT: {charge.amount} €</Text>
              {charge.vatRate > 0 && (
                <>
                  <Text style={styles.chargeVat}>
                    TVA ({charge.vatRate}%): {charge.vatAmount} €
                  </Text>
                  <Text style={styles.chargeTotalAmount}>
                    TTC: {charge.totalAmount} €
                  </Text>
                </>
              )}
              <Text style={styles.chargeDate}>
                Échéance: {formatDate(charge.dueDate)}
              </Text>
              {charge.paymentDate && (
                <Text style={styles.paymentDate}>
                  Payé le: {formatDate(charge.paymentDate)}
                </Text>
              )}
            </View>
            <View style={styles.chargeActions}>
              {charge.status === 'pending' && (
                <TouchableOpacity
                  onPress={() => markAsPaid(charge.id)}
                  style={styles.paidButton}>
                  <Text style={styles.paidButtonText}>Marquer comme payé</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => deleteCharge(charge.id)}
                style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  inputContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  picker: {
    height: 50,
    color: '#333',
  },
  pickerItem: {
    fontSize: 16,
    color: '#333',
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
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1c1c1e',
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  totalContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  chargesList: {
    flex: 1,
  },
  chargeItem: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  chargeInfo: {
    flex: 1,
  },
  chargeType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  chargeAmount: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  chargeVat: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  chargeTotalAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
    marginBottom: 4,
  },
  chargeDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  paymentDate: {
    fontSize: 14,
    color: '#34C759',
    marginTop: 4,
  },
  chargeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  paidButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  paidButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
  },
  amountsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  amountText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  finalAmount: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
});