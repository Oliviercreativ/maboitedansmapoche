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
  dueDate: string;
  status: 'pending' | 'paid';
  paymentDate?: string;
  month: string | null;
  vatRate?: number;
  vatAmount?: number;
  totalAmount?: number;
  // Nouveaux champs pour les totaux URSSAF
  totalCharges?: number;
  formationFee?: number;
  vatToCollect?: number;
}

interface Settings {
  urssafRate: number;
  isVatEnabled: boolean;
}

const CHARGE_TYPES = ['CA Mensuel', 'URSSAF'];

const VAT_RATES = [
  { label: 'Non assujetti (0%)', value: 0 },
  { label: 'TVA 5.5%', value: 5.5 },
  { label: 'TVA 10%', value: 10 },
  { label: 'TVA 20%', value: 20 },
];

const calculateAmounts = (ttcAmount: number, vatRate: number) => {
  if (!ttcAmount || isNaN(ttcAmount)) {
    return {
      baseAmount: 0,
      vatAmount: 0,
      totalAmount: 0
    };
  }

  if (vatRate === 0) {
    return {
      baseAmount: ttcAmount,
      vatAmount: 0,
      totalAmount: ttcAmount
    };
  }
  
  // Calcul du HT à partir du TTC avec le taux sélectionné
  const baseAmount = ttcAmount / (1 + vatRate / 100);
  const vatAmount = ttcAmount - baseAmount;
  
  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalAmount: ttcAmount
  };
};

const formatMonthYear = (date: Date) => {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

export default function SocialChargesScreen() {
  const [charges, setCharges] = useState<SocialCharge[]>([]);
  const [type, setType] = useState(CHARGE_TYPES[0]);
  const [amount, setAmount] = useState('');
  const [ttcAmount, setTtcAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingCharge, setEditingCharge] = useState<SocialCharge | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    urssafRate: 23.1,
    isVatEnabled: false
  });
  const [vatRate, setVatRate] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calculatedAmounts, setCalculatedAmounts] = useState({
    baseAmount: 0,
    vatAmount: 0,
    totalAmount: 0
  });

  // Calcul des totaux
  const totalMonthlyRevenue = charges
    .filter(charge => charge.type === 'CA Mensuel' && charge.status === 'pending')
    .reduce((sum, charge) => sum + charge.amount, 0);

  const totalPending = Math.round(totalMonthlyRevenue * settings.urssafRate) / 100;
  const formationFee = Math.round(totalMonthlyRevenue * 0.2) / 100; // 0.2% du CA
  const totalWithFormation = totalPending + formationFee;

  const totalVAT = charges
    .filter(charge => charge.type === 'CA Mensuel' && charge.status === 'pending')
    .reduce((sum, charge) => sum + (charge.vatAmount || 0), 0);

  useEffect(() => {
    if (type === 'URSSAF') {
      setTtcAmount(totalPending.toFixed(2));
      setCalculatedAmounts({
        baseAmount: totalPending,
        vatAmount: totalVAT,
        totalAmount: totalPending
      });
    } else {
      setTtcAmount('');
      setCalculatedAmounts({ baseAmount: 0, vatAmount: 0, totalAmount: 0 });
    }
  }, [type, totalPending, totalVAT]);

  useEffect(() => {
    loadCharges();
    loadSettings();
  }, []);

  useEffect(() => {
    // Recalcul des totaux après chaque changement des charges
    const monthlyRevenue = charges
      .filter(charge => charge.type === 'CA Mensuel' && charge.status === 'pending')
      .reduce((sum, charge) => sum + charge.amount, 0);

    const pending = Math.round(monthlyRevenue * settings.urssafRate) / 100;
    const formation = Math.round(monthlyRevenue * 0.2) / 100;
    const vat = charges
      .filter(charge => charge.type === 'CA Mensuel' && charge.status === 'pending')
      .reduce((sum, charge) => sum + (charge.vatAmount || 0), 0);

    if (type === 'URSSAF') {
      setTtcAmount(pending.toFixed(2));
      setCalculatedAmounts({
        baseAmount: pending,
        vatAmount: vat,
        totalAmount: pending + formation
      });
    }
  }, [charges, settings.urssafRate, type]);

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
      const result = calculateAmounts(ttc, newVatRate);
      setCalculatedAmounts(result);
      setAmount(result.baseAmount.toString());
    } else {
      setCalculatedAmounts({ baseAmount: 0, vatAmount: 0, totalAmount: 0 });
      setAmount('');
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
        amount: type === 'URSSAF' ? parseFloat(ttcAmount) || 0 : calculatedAmounts.baseAmount,
        vatRate: type === 'URSSAF' ? 0 : vatRate,
        vatAmount: type === 'URSSAF' ? parseFloat(calculatedAmounts.vatAmount.toString()) || 0 : calculatedAmounts.vatAmount,
        totalAmount: type === 'URSSAF' ? parseFloat(ttcAmount) || 0 : calculatedAmounts.totalAmount,
        dueDate: dueDate.toISOString(),
        status: 'pending',
        month: type === 'CA Mensuel' ? currentMonth.toISOString() : null,
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

  const addCharge = async () => {
    if (!type || !dueDate) return;

    try {
      if (type === 'URSSAF') {
        // Vérifier s'il y a des CA mensuels en attente pour le mois en cours
        const pendingCA = charges.filter(charge => 
          charge.type === 'CA Mensuel' && 
          charge.status === 'pending' &&
          new Date(charge.month || '').getMonth() === currentMonth.getMonth()
        );

        if (pendingCA.length === 0) {
          Alert.alert('Erreur', 'Aucun CA mensuel en attente pour ce mois.');
          return;
        }

        // Sauvegarde des totaux du mois
        const monthlyTotals = {
          id: Date.now().toString(),
          type: 'URSSAF',
          month: currentMonth.toISOString(),
          totalCharges: totalPending,
          formationFee: formationFee,
          vatToCollect: totalVAT,
          totalAmount: totalWithFormation,
          dueDate: dueDate.toISOString(),
          status: 'pending',
          amount: totalWithFormation
        };

        // Marquer tous les CA mensuels du mois en cours comme payés
        const updatedCharges = charges.map(charge => {
          if (charge.type === 'CA Mensuel' && charge.status === 'pending') {
            const chargeMonth = new Date(charge.month || '').getMonth();
            const currentMonthValue = currentMonth.getMonth();
            
            if (chargeMonth === currentMonthValue) {
              return {
                ...charge,
                status: 'paid',
                paymentDate: new Date().toISOString()
              };
            }
          }
          return charge;
        });

        // Ajouter la déclaration URSSAF
        const finalCharges = [...updatedCharges, monthlyTotals];
        
        // Sauvegarder les changements
        await AsyncStorage.setItem('socialCharges', JSON.stringify(finalCharges));
        setCharges(finalCharges);

        // Réinitialiser tous les états
        setTtcAmount('');
        setAmount('');
        setDueDate(new Date());
        setCalculatedAmounts({ baseAmount: 0, vatAmount: 0, totalAmount: 0 });
        setVatRate(0);
        setType('CA Mensuel'); // Remettre le type par défaut

        // Afficher un message de confirmation
        Alert.alert(
          'Déclaration sauvegardée',
          'La déclaration URSSAF a été enregistrée et les CA ont été marqués comme payés.'
        );
      } else {
        // Vérifier si le montant est saisi pour un CA Mensuel
        if (!ttcAmount) {
          Alert.alert('Erreur', 'Veuillez saisir un montant');
          return;
        }

        // Cas normal pour l'ajout d'un CA Mensuel
        const newCharge = {
          id: Date.now().toString(),
          type,
          amount: parseFloat(ttcAmount),
          vatRate,
          vatAmount: calculatedAmounts.vatAmount,
          totalAmount: calculatedAmounts.totalAmount,
          dueDate: dueDate.toISOString(),
          status: 'pending',
          month: currentMonth.toISOString()
        };

        const updatedCharges = [...charges, newCharge];
        await AsyncStorage.setItem('socialCharges', JSON.stringify(updatedCharges));
        setCharges(updatedCharges);

        // Réinitialiser les champs
        setTtcAmount('');
        setAmount('');
        setDueDate(new Date());
        setCalculatedAmounts({ baseAmount: 0, vatAmount: 0, totalAmount: 0 });
        setVatRate(0);
      }
    } catch (error) {
      console.error('Error saving charge:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder la charge');
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

  const resetForm = () => {
    setTtcAmount('');
    setAmount('');
    setDueDate(new Date());
    setCalculatedAmounts({ baseAmount: 0, vatAmount: 0, totalAmount: 0 });
    setVatRate(0);
    setType('CA Mensuel');
  };

  const getMonthlyCharges = () => {
    const monthlyData: { [key: string]: { charges: number; vat: number; isPaid: boolean } } = {};

    charges.forEach(charge => {
      if (charge.type === 'CA Mensuel') {
        const monthKey = charge.month || '';
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { charges: 0, vat: 0, isPaid: false };
        }
        
        if (charge.status === 'pending') {
          monthlyData[monthKey].charges += (charge.amount * settings.urssafRate / 100);
          monthlyData[monthKey].vat += (charge.vatAmount || 0);
          monthlyData[monthKey].isPaid = false;
        }
      }
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([month, data]) => ({
        month: new Date(month),
        ...data
      }));
  };

  const monthlyCharges = getMonthlyCharges();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {monthlyCharges.map((monthData, index) => (
          <View key={monthData.month.toISOString()} style={styles.monthCard}>
            <View style={styles.monthHeader}>
              <Text style={styles.monthTitle}>{formatMonthYear(monthData.month)}</Text>
              <View style={[styles.statusBadge, monthData.isPaid ? styles.statusPaid : styles.statusPending]}>
                <Text style={styles.statusText}>
                  {monthData.isPaid ? 'Payé' : 'En attente'}
                </Text>
              </View>
            </View>

            <View style={styles.chargeRow}>
              <Text style={styles.chargeLabel}>Charges URSSAF ({settings.urssafRate}%):</Text>
              <Text style={styles.chargeAmount}>{monthData.charges.toFixed(2)} €</Text>
            </View>

            {settings.isVatEnabled && (
              <View style={styles.chargeRow}>
                <Text style={styles.chargeLabel}>TVA à reverser:</Text>
                <Text style={styles.chargeAmount}>{monthData.vat.toFixed(2)} €</Text>
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total à payer:</Text>
              <Text style={styles.totalAmount}>
                {(monthData.charges + monthData.vat).toFixed(2)} €
              </Text>
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
    backgroundColor: '#f2f2f7',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  monthCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusPending: {
    backgroundColor: '#FFE58C',
  },
  statusPaid: {
    backgroundColor: '#34C759',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1c1c1e',
  },
  chargeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chargeLabel: {
    fontSize: 15,
    color: '#666',
  },
  chargeAmount: {
    fontSize: 16,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
});