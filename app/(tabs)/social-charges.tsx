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
  Modal,
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
  ttcAmount?: number;
  // Nouveaux champs pour les totaux URSSAF
  totalCharges?: number;
  formationFee?: number;
  vatToCollect?: number;
}

interface Settings {
  urssafRate: number;
  isVatEnabled: boolean;
}

interface VATHistory {
  id: string;
  month: string;
  baseAmount: number;
  vatAmount: number;
  vatRate: number;
  createdAt: string;
}

interface ValidationEntry {
  month: string;
  totalAmount: number;
  totalVat: number;
  socialCharges: number;
  formationFee: number;
  validatedAt: string;
  charges: SocialCharge[];
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
  const [vatHistory, setVatHistory] = useState<VATHistory[]>([]);
  const [pendingMonthlyCharges, setPendingMonthlyCharges] = useState<SocialCharge[]>([]);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validatedEntries, setValidatedEntries] = useState<ValidationEntry[]>([]);

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
    loadVatHistory();
    loadValidations();
  }, []);

  useEffect(() => {
    // Recalcul des totaux après chaque changement des charges
    const monthlyRevenue = charges
      .filter(charge => charge.type === 'CA Mensuel' && charge.status === 'pending')
      .reduce((sum, charge) => sum + charge.amount, 0);

    const pending = Math.round(monthlyRevenue * settings.urssafRate) / 100;
    const formation = Math.round(monthlyRevenue * 0.2) / 100;
    const vat = charges
      .filter(charge => charge.type === 'CA Mensuel' && 
              charge.status === 'pending')
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

  useEffect(() => {
    if (type === 'URSSAF') {
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);
      
      const monthlyCharges = charges.filter(charge => 
        charge.type === 'CA Mensuel' && 
        charge.status === 'pending' &&
        new Date(charge.month + '-01').getMonth() === currentMonthStart.getMonth()
      );
      
      setPendingMonthlyCharges(monthlyCharges);
      
      if (monthlyCharges.length > 0) {
        setShowValidateModal(true);
      }
    }
  }, [type, charges]);

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
      const storedCharges = await AsyncStorage.getItem('charges');
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

  const loadVatHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem('vatHistory');
      if (storedHistory) {
        setVatHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique TVA:', error);
    }
  };

  const loadValidations = async () => {
    try {
      const storedValidations = await AsyncStorage.getItem('validatedEntries');
      if (storedValidations) {
        setValidatedEntries(JSON.parse(storedValidations));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des validations:', error);
    }
  };

  const saveCharges = async (newCharges: SocialCharge[]) => {
    try {
      await AsyncStorage.setItem('charges', JSON.stringify(newCharges));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des charges:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les charges');
    }
  };

  const saveVatHistory = async (history: VATHistory[]) => {
    try {
      await AsyncStorage.setItem('vatHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'historique TVA:', error);
    }
  };

  const saveValidations = async (entries: ValidationEntry[]) => {
    try {
      await AsyncStorage.setItem('validatedEntries', JSON.stringify(entries));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des validations:', error);
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

  const addCharge = async () => {
    try {
      const parsedAmount = parseFloat(amount);
      const parsedTtcAmount = parseFloat(ttcAmount);
      const parsedVatRate = parseFloat(vatRate.toString());

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert('Erreur', 'Veuillez entrer un montant valide');
        return;
      }

      if (settings.isVatEnabled && type === 'CA Mensuel' && (isNaN(parsedVatRate) || parsedVatRate < 0)) {
        Alert.alert('Erreur', 'Veuillez entrer un taux de TVA valide');
        return;
      }

      // Utiliser les montants calculés par calculateAmounts
      const amounts = calculateAmounts(parsedTtcAmount, parsedVatRate);

      // Si c'est un CA Mensuel avec TVA, ajouter à l'historique
      if (type === 'CA Mensuel' && settings.isVatEnabled && parsedVatRate > 0) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const vatEntry: VATHistory = {
          id: Date.now().toString(),
          month: currentMonth,
          baseAmount: amounts.baseAmount,
          vatAmount: amounts.vatAmount,
          vatRate: parsedVatRate,
          createdAt: new Date().toISOString()
        };
        
        const updatedHistory = [...vatHistory, vatEntry];
        setVatHistory(updatedHistory);
        await saveVatHistory(updatedHistory);
      }

      const newCharge: SocialCharge = {
        id: editingCharge?.id || Date.now().toString(),
        type,
        amount: amounts.baseAmount,
        vatRate: settings.isVatEnabled ? parsedVatRate : 0,
        vatAmount: amounts.vatAmount,
        ttcAmount: amounts.totalAmount,
        dueDate: dueDate.toISOString(),
        status: 'pending',
        month: type === 'CA Mensuel' ? new Date().toISOString().slice(0, 7) : null,
        createdAt: new Date().toISOString(),
      };

      let updatedCharges: SocialCharge[];
      if (editingCharge) {
        updatedCharges = charges.map(charge =>
          charge.id === editingCharge.id ? newCharge : charge
        );
      } else {
        updatedCharges = [...charges, newCharge];
      }

      setCharges(updatedCharges);
      await saveCharges(updatedCharges);

      // Reset form
      setAmount('');
      setTtcAmount('');
      setType(CHARGE_TYPES[0]);
      setDueDate(new Date());
      setEditingCharge(null);
      setVatRate(0);
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

  const resetForm = async () => {
    try {
      // Filtrer les charges pour ne garder que celles qui ne sont pas en statut 'pending'
      const updatedCharges = charges.filter(charge => charge.status !== 'pending');

      // Sauvegarder les changements
      await AsyncStorage.setItem('charges', JSON.stringify(updatedCharges));
      setCharges(updatedCharges);

      // Réinitialiser tous les champs du formulaire
      setTtcAmount('');
      setAmount('');
      setDueDate(new Date());
      setCalculatedAmounts({ baseAmount: 0, vatAmount: 0, totalAmount: 0 });
      setVatRate(0);
      setType('CA Mensuel');

      // Réinitialiser les compteurs globaux
      const currentYear = new Date().getFullYear();
      await AsyncStorage.removeItem(`@yearlyVAT_${currentYear}`);
      await AsyncStorage.removeItem('@validatedCA');
      await AsyncStorage.removeItem('@currentMonthVAT');

      // Afficher un message de confirmation
      Alert.alert(
        'Réinitialisation effectuée',
        'Tous les compteurs ont été remis à zéro.'
      );

      // Recharger les données
      loadCharges();
    } catch (error) {
      console.error('Error resetting form:', error);
      Alert.alert('Erreur', 'Impossible de réinitialiser les compteurs');
    }
  };

  const validateMonthlyRevenue = async () => {
    try {
      // Marquer les charges comme validées
      const updatedCharges = charges.map(charge => {
        if (pendingMonthlyCharges.some(pc => pc.id === charge.id)) {
          return {
            ...charge,
            status: 'validated' as 'pending' | 'validated' | 'paid'
          };
        }
        return charge;
      });

      // Calculer les totaux du mois
      const monthTotal = pendingMonthlyCharges.reduce((sum, charge) => sum + charge.amount, 0);
      const monthVatTotal = pendingMonthlyCharges.reduce((sum, charge) => sum + (charge.vatAmount || 0), 0);
      const socialCharges = Math.round(monthTotal * settings.urssafRate) / 100;
      const formationFee = Math.round(monthTotal * 0.2) / 100;

      const currentMonth = new Date().toISOString().slice(0, 7);

      // Créer l'entrée de validation
      const validationEntry: ValidationEntry = {
        month: currentMonth,
        totalAmount: monthTotal,
        totalVat: monthVatTotal,
        socialCharges: socialCharges,
        formationFee: formationFee,
        validatedAt: new Date().toISOString(),
        charges: pendingMonthlyCharges
      };

      // Mettre à jour les validations
      const updatedValidations = [
        ...validatedEntries.filter(v => v.month !== currentMonth),
        validationEntry
      ];

      await saveValidations(updatedValidations);
      await saveCharges(updatedCharges);
      
      setValidatedEntries(updatedValidations);
      setCharges(updatedCharges);
      setShowValidateModal(false);

      Alert.alert(
        'Validation effectuée',
        `CA du mois validé:\n` +
        `Total HT: ${monthTotal.toFixed(2)} €\n` +
        `TVA: ${monthVatTotal.toFixed(2)} €\n` +
        `Charges URSSAF (${settings.urssafRate}%): ${socialCharges.toFixed(2)} €\n` +
        `Formation (0.2%): ${formationFee.toFixed(2)} €`
      );
    } catch (error) {
      console.error('Erreur lors de la validation du CA:', error);
      Alert.alert('Erreur', 'Impossible de valider le CA du mois');
    }
  };

  const renderValidationHistory = () => (
    <View style={styles.validationHistoryContainer}>
      <Text style={styles.validationHistoryTitle}>Historique des validations</Text>
      {validatedEntries
        .sort((a, b) => b.month.localeCompare(a.month))
        .map(entry => (
          <View key={entry.month} style={styles.validationItem}>
            <Text style={styles.validationMonth}>
              {formatMonthYear(new Date(entry.month + '-01'))}
            </Text>
            <View style={styles.validationDetails}>
              <Text style={styles.validationText}>CA HT: {entry.totalAmount.toFixed(2)} €</Text>
              <Text style={styles.validationText}>TVA: {entry.totalVat.toFixed(2)} €</Text>
              <Text style={styles.validationText}>
                URSSAF ({settings.urssafRate}%): {entry.socialCharges.toFixed(2)} €
              </Text>
              <Text style={styles.validationText}>
                Formation (0.2%): {entry.formationFee.toFixed(2)} €
              </Text>
            </View>
          </View>
        ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Type de charge</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={type}
              onValueChange={(itemValue) => {
                setType(itemValue);
                // Réinitialiser le taux de TVA si on change de type
                if (itemValue !== 'CA Mensuel') {
                  setVatRate(0);
                }
              }}
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

        {type === 'URSSAF' && (
          <View>
            <View style={styles.monthDisplay}>
              <Text style={styles.monthLabel}>Déclaration du mois :</Text>
              <Text style={styles.monthValue}>{formatMonthYear(currentMonth)}</Text>
            </View>
            
            <View style={styles.chargeAmountContainer}>
              <Text style={styles.chargeAmountLabel}>
                Charges URSSAF ({settings.urssafRate}% du CA HT) :
              </Text>
              <Text style={styles.chargeAmount}>{totalPending.toFixed(2)} €</Text>
            </View>
            

          </View>
        )}

        {type === 'CA Mensuel' && (
          <View>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Taux de TVA</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={vatRate}
                  onValueChange={(itemValue) => {
                    setVatRate(itemValue);
                    if (ttcAmount) {
                      updateAmounts(ttcAmount, itemValue);
                    }
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
                <Text style={styles.amountText}>
                  Montant HT: {calculatedAmounts.baseAmount.toFixed(2)} €
                </Text>
                <Text style={styles.amountText}>
                  TVA ({vatRate}%): {calculatedAmounts.vatAmount.toFixed(2)} €
                </Text>
                <Text style={[styles.amountText, styles.totalAmount]}>
                  Total TTC: {calculatedAmounts.totalAmount.toFixed(2)} €
                </Text>
              </View>
            )}
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

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={addCharge}
          >
            <Text style={styles.buttonText}>
              {type === 'URSSAF' 
                ? 'Ajouter une charge URSSAF'
                : type === 'CA Mensuel'
                  ? editingCharge ? 'Modifier le CA' : 'Ajouter un CA'
                  : editingCharge 
                    ? 'Modifier la charge' 
                    : 'Ajouter une charge'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addButton, styles.resetButton]}
            onPress={resetForm}
          >
            <Text style={styles.buttonText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.totalContainer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>CA Mensuel total:</Text>
          <Text style={styles.totalAmount}>{totalMonthlyRevenue.toFixed(2)} €</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Total charges en attente ({settings.urssafRate}% du CA HT):
          </Text>
          <Text style={styles.totalAmount}>{totalPending.toFixed(2)} €</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Frais de la formation (0.2% du CA):
          </Text>
          <Text style={styles.totalAmount}>{formationFee.toFixed(2)} €</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TVA à reverser:</Text>
          <Text style={styles.totalAmount}>{totalVAT.toFixed(2)} €</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total à payer (hors TVA):</Text>
          <Text style={[styles.totalAmount, styles.finalAmount]}>
            {totalWithFormation.toFixed(2)} €
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TVA totale:</Text>
          <Text style={[styles.totalAmount, styles.vatAmount]}>
            {totalVAT.toFixed(2)} €
          </Text>
        </View>
      </View>

      {settings.isVatEnabled && (
        <View style={styles.vatHistoryContainer}>
          <Text style={styles.vatHistoryTitle}>Historique TVA</Text>
          {vatHistory
            .sort((a, b) => b.month.localeCompare(a.month))
            .map((entry) => (
              <View key={entry.id} style={styles.vatHistoryItem}>
                <Text style={styles.vatHistoryMonth}>
                  {formatMonthYear(new Date(entry.month + '-01'))}
                </Text>
                <View style={styles.vatHistoryDetails}>
                  <Text style={styles.vatHistoryText}>
                    Base HT: {entry.baseAmount.toFixed(2)} €
                  </Text>
                  <Text style={styles.vatHistoryText}>
                    TVA ({entry.vatRate}%): {entry.vatAmount.toFixed(2)} €
                  </Text>
                </View>
              </View>
            ))}
        </View>
      )}

      {settings.isVatEnabled && renderValidationHistory()}

      <ScrollView style={styles.chargesList}>
        {charges
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .map((charge) => (
          <View key={charge.id} style={styles.chargeItem}>
            <View style={styles.chargeInfo}>
              <Text style={styles.chargeType}>{charge.type}</Text>
              {charge.type === 'CA Mensuel' ? (
                <View>
                  <Text style={styles.chargeAmount}>HT: {charge.amount.toFixed(2)} €</Text>
                  {settings.isVatEnabled && charge.vatRate > 0 && (
                    <>
                      <Text style={styles.chargeVat}>
                        TVA ({charge.vatRate}%): {charge.vatAmount.toFixed(2)} €
                      </Text>
                      <Text style={styles.chargeTotalAmount}>
                        TTC: {charge.ttcAmount.toFixed(2)} €
                      </Text>
                    </>
                  )}
                </View>
              ) : (
                <Text style={styles.chargeAmount}>{charge.amount.toFixed(2)} €</Text>
              )}
              <Text style={styles.chargeDate}>
                Échéance: {new Date(charge.dueDate).toLocaleDateString()}
              </Text>
              {charge.status === 'paid' && (
                <Text style={styles.paidStatus}>Payé le {new Date(charge.paymentDate!).toLocaleDateString()}</Text>
              )}
              {charge.month && (
                <Text style={styles.chargeMonth}>
                  Mois de déclaration: {formatMonthYear(new Date(charge.month))}
                </Text>
              )}
            </View>
            <View style={styles.chargeActions}>
              {charge.type === 'URSSAF' && charge.status === 'pending' && (
                <TouchableOpacity
                  style={styles.payButton}
                  onPress={() => markAsPaid(charge.id)}
                >
                  <Text style={styles.payButtonText}>Marquer comme payé</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteCharge(charge.id)}
              >
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={showValidateModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Validation du CA mensuel</Text>
            <Text style={styles.modalSubtitle}>
              Veuillez valider le CA du mois avant de déclarer l'URSSAF
            </Text>

            <View style={styles.chargesList}>
              {pendingMonthlyCharges.map(charge => (
                <View key={charge.id} style={styles.chargeItem}>
                  <Text style={styles.chargeAmount}>
                    HT: {charge.amount.toFixed(2)} €
                  </Text>
                  {charge.vatAmount > 0 && (
                    <Text style={styles.chargeVat}>
                      TVA ({charge.vatRate}%): {charge.vatAmount.toFixed(2)} €
                    </Text>
                  )}
                  <Text style={styles.chargeTotal}>
                    TTC: {charge.ttcAmount.toFixed(2)} €
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.modalTotals}>
              <Text style={styles.totalText}>
                Total HT: {pendingMonthlyCharges.reduce((sum, c) => sum + c.amount, 0).toFixed(2)} €
              </Text>
              <Text style={styles.totalText}>
                Total TVA: {pendingMonthlyCharges.reduce((sum, c) => sum + (c.vatAmount || 0), 0).toFixed(2)} €
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowValidateModal(false);
                  setType('CA Mensuel');
                }}
              >
                <Text style={styles.buttonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.validateButton]}
                onPress={validateMonthlyRevenue}
              >
                <Text style={styles.buttonText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    flex: 1,
  },
  resetButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
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
    color: '#333',
    marginBottom: 4,
  },
  chargeAmount: {
    fontSize: 15,
    color: '#333',
    marginBottom: 2,
  },
  chargeVat: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  chargeTotalAmount: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
    marginBottom: 4,
  },
  chargeDate: {
    fontSize: 14,
    color: '#666',
  },
  paidStatus: {
    fontSize: 14,
    color: '#34C759',
    marginTop: 4,
  },
  chargeMonth: {
    fontSize: 14,
    color: '#666',
  },
  chargeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  payButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  payButtonText: {
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
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  finalAmount: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  vatAmount: {
    color: '#FF9500',
    fontWeight: '600',
  },
  monthDisplay: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  monthLabel: {
    fontSize: 15,
    color: '#666',
    marginBottom: 4,
  },
  monthValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  chargeAmountContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  chargeAmountLabel: {
    fontSize: 15,
    color: '#666',
    marginBottom: 4,
  },
  chargeAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  vatHistoryContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vatHistoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#2c3e50',
  },
  vatHistoryItem: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  vatHistoryMonth: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
    color: '#2c3e50',
  },
  vatHistoryDetails: {
    marginLeft: 10,
  },
  vatHistoryText: {
    fontSize: 14,
    color: '#34495e',
    marginVertical: 2,
  },
  validationHistoryContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  validationHistoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#2c3e50',
  },
  validationItem: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  validationMonth: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
    color: '#2c3e50',
  },
  validationDetails: {
    marginLeft: 10,
  },
  validationText: {
    fontSize: 14,
    color: '#34495e',
    marginVertical: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
    color: '#2c3e50',
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#7f8c8d',
  },
  chargeItem: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  chargeAmount: {
    fontSize: 16,
    color: '#2c3e50',
  },
  chargeVat: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 5,
  },
  chargeTotal: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginTop: 5,
  },
  modalTotals: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  validateButton: {
    backgroundColor: '#2ecc71',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});