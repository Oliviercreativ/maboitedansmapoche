import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SocialCharge {
  id: string;
  type: string;
  status: string;
  month: string;
  amount: number;
  vatAmount: number;
}

interface Settings {
  urssafRate: number;
  isVatEnabled: boolean;
}

interface ValidatedCA {
  amount: number;
  vat: number;
  month: string;
  validatedAt: string;
}

export default function ExpensesScreen() {
  const [charges, setCharges] = useState<SocialCharge[]>([]);
  const [settings, setSettings] = useState<Settings>({
    urssafRate: 23.1,
    isVatEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [validatedCA, setValidatedCA] = useState<ValidatedCA | null>(null);
  const [currentMonthCA, setCurrentMonthCA] = useState({ amount: 0, vat: 0 });
  const [currentMonthVAT, setCurrentMonthVAT] = useState<{ amount: number; month: string } | null>(null);
  const [yearlyVAT, setYearlyVAT] = useState<{ total: number; year: number } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCharges(),
        loadSettings(),
        loadValidatedCA(),
        loadCurrentMonthCA(),
        loadCurrentMonthVAT(),
        loadYearlyVAT(),
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
    setLoading(false);
  }, []);

  // Recharge les données chaque fois que l'écran devient actif
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('companySettings');
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
    }
  };

  const loadCharges = async () => {
    try {
      const storedCharges = await AsyncStorage.getItem('charges');
      if (storedCharges) {
        setCharges(JSON.parse(storedCharges));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des charges:', error);
    }
  };

  const loadValidatedCA = async () => {
    try {
      const storedCA = await AsyncStorage.getItem('validatedCA');
      if (storedCA) {
        setValidatedCA(JSON.parse(storedCA));
      }
    } catch (error) {
      console.error('Erreur lors du chargement du CA validé:', error);
    }
  };

  const loadCurrentMonthCA = async () => {
    try {
      const storedCharges = await AsyncStorage.getItem('charges');
      if (storedCharges) {
        const allCharges = JSON.parse(storedCharges);
        const currentDate = new Date();
        const currentMonthKey = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
        
        let totalAmount = 0;
        let totalVAT = 0;
        
        allCharges.forEach((charge: SocialCharge) => {
          if (charge.type === 'CA Mensuel' && charge.month === currentMonthKey) {
            totalAmount += charge.amount || 0;
            totalVAT += charge.vatAmount || 0;
          }
        });
        
        setCurrentMonthCA({ amount: totalAmount, vat: totalVAT });
      }
    } catch (error) {
      console.error('Erreur lors du chargement du CA du mois:', error);
    }
  };

  const loadCurrentMonthVAT = async () => {
    try {
      const storedVAT = await AsyncStorage.getItem('@currentMonthVAT');
      if (storedVAT) {
        setCurrentMonthVAT(JSON.parse(storedVAT));
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la TVA du mois:', error);
    }
  };

  const loadYearlyVAT = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const storedVAT = await AsyncStorage.getItem(`@yearlyVAT_${currentYear}`);
      if (storedVAT) {
        setYearlyVAT(JSON.parse(storedVAT));
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la TVA annuelle:', error);
    }
  };

  // Fonction pour formater la date en mois/année
  const formatMonthYear = (date: Date | string): string => {
    try {
      if (!date) return '';
      
      const dateObject = typeof date === 'string' ? new Date(date) : date;
      
      // Vérifier si la date est valide
      if (isNaN(dateObject.getTime())) {
        return '';
      }
      
      return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(dateObject);
    } catch (error) {
      console.error('Erreur de formatage de date:', error);
      return '';
    }
  };

  // Fonction pour grouper les charges par mois
  const getMonthlyCharges = () => {
    interface MonthlyDataType {
      month: Date;
      charges: number;
      vat: number;
      formation: number;
      total: number;
    }

    const monthlyDataMap = new Map<string, MonthlyDataType>();

    charges.forEach(charge => {
      if (charge.type === 'CA Mensuel' && charge.status === 'pending') {
        try {
          // Convertir la chaîne de date en objet Date
          const chargeDate = new Date(charge.month);
          if (isNaN(chargeDate.getTime())) {
            console.error('Date invalide:', charge.month);
            return;
          }

          const monthKey = charge.month;
          if (!monthlyDataMap.has(monthKey)) {
            monthlyDataMap.set(monthKey, {
              month: chargeDate,
              charges: 0,
              vat: 0,
              formation: 0,
              total: 0
            });
          }

          const monthData = monthlyDataMap.get(monthKey)!;
          const chargeAmount = charge.amount || 0;
          const urssafCharges = (chargeAmount * settings.urssafRate / 100);
          const formationCharges = (chargeAmount * 0.2 / 100);

          monthData.charges += urssafCharges;
          monthData.vat += (charge.vatAmount || 0);
          monthData.formation += formationCharges;
          monthData.total = monthData.charges + monthData.formation;
        } catch (error) {
          console.error('Erreur lors du traitement de la charge:', error);
        }
      }
    });

    // Convertir la Map en tableau et trier par date
    return Array.from(monthlyDataMap.values()).sort((a, b) => b.month.getTime() - a.month.getTime());
  };

  const monthlyCharges = getMonthlyCharges();

  // Fonction pour calculer les totaux du mois en cours
  const calculateMonthlyTotals = () => {
    const currentDate = new Date();
    const currentMonthKey = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
    
    let totalHT = 0;
    let totalVAT = 0;
    
    charges.forEach(charge => {
      if (charge.type === 'CA Mensuel' && charge.month === currentMonthKey) {
        totalHT += charge.amount || 0;
        totalVAT += charge.vatAmount || 0;
      }
    });

    const chargesURSSAF = totalHT * settings.urssafRate / 100;
    const formationFee = totalHT * 0.2 / 100;
    const totalToPay = chargesURSSAF + formationFee;

    return {
      totalHT,
      chargesURSSAF,
      formationFee,
      totalToPay,
      totalVAT
    };
  };

  // Fonction pour calculer les totaux annuels
  const calculateYearlyTotals = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    let totalHT = 0;
    let totalVAT = yearlyVAT?.total || 0;
    
    charges.forEach(charge => {
      if (charge.type === 'CA Mensuel') {
        const chargeDate = new Date(charge.month || '');
        if (chargeDate.getFullYear() === currentYear) {
          totalHT += charge.amount || 0;
        }
      }
    });

    return {
      totalHT,
      totalVAT,
      year: currentYear
    };
  };

  const monthlyTotals = calculateMonthlyTotals();
  const yearlyTotals = calculateYearlyTotals();

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
        <View style={styles.header}>
          <Text style={styles.title}>Charges à payer</Text>
        </View>

        {monthlyCharges.map((monthData) => {
          // Créer une clé unique sûre
          const safeKey = typeof monthData.month === 'string' ? monthData.month : 
            (monthData.month instanceof Date ? monthData.month.toISOString() : Date.now().toString());
          
          return (
            <View key={safeKey} style={styles.monthCard}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>{formatMonthYear(monthData.month)}</Text>
              </View>

              <View style={styles.chargeRow}>
                <Text style={styles.chargeLabel}>Charges URSSAF ({settings.urssafRate}%):</Text>
                <Text style={styles.chargeAmount}>{monthData.charges.toFixed(2)} €</Text>
              </View>

              <View style={styles.chargeRow}>
                <Text style={styles.chargeLabel}>Formation (0.2%):</Text>
                <Text style={styles.chargeAmount}>{monthData.formation.toFixed(2)} €</Text>
              </View>

              {settings.isVatEnabled && (
                <View style={styles.chargeRow}>
                  <Text style={styles.chargeLabel}>TVA à reverser:</Text>
                  <Text style={[styles.chargeAmount, styles.vatAmount]}>
                    {monthData.vat.toFixed(2)} €
                  </Text>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total à payer:</Text>
                <Text style={styles.totalAmount}>
                  {(monthData.total + monthData.vat).toFixed(2)} €
                </Text>
              </View>
            </View>
          );
        })}

        {monthlyCharges.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Aucune charge en attente de paiement
            </Text>
          </View>
        )}

        {validatedCA && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Dernier CA validé</Text>
            </View>

            <View style={styles.monthCard}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>
                  {formatMonthYear(new Date(validatedCA.month))}
                </Text>
                <Text style={styles.validationDate}>
                  Validé le {new Date(validatedCA.validatedAt).toLocaleDateString('fr-FR')}
                </Text>
              </View>

              <View style={styles.chargeRow}>
                <Text style={styles.chargeLabel}>CA HT:</Text>
                <Text style={styles.chargeAmount}>{validatedCA.amount.toFixed(2)} €</Text>
              </View>

              {settings.isVatEnabled && (
                <View style={styles.chargeRow}>
                  <Text style={styles.chargeLabel}>TVA:</Text>
                  <Text style={[styles.chargeAmount, styles.vatAmount]}>
                    {validatedCA.vat.toFixed(2)} €
                  </Text>
                </View>
              )}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total TTC:</Text>
                <Text style={styles.totalAmount}>
                  {(validatedCA.amount + validatedCA.vat).toFixed(2)} €
                </Text>
              </View>
            </View>
          </>
        )}

        <View style={[styles.header, styles.yearlyHeader]}>
          <Text style={styles.title}>Totaux de l'année {yearlyTotals.year}</Text>
        </View>

        <View style={[styles.monthCard, styles.yearlyCard]}>
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>CA HT total:</Text>
            <Text style={styles.chargeAmount}>{yearlyTotals.totalHT.toFixed(2)} €</Text>
          </View>

          {settings.isVatEnabled && (
            <View style={styles.chargeRow}>
              <Text style={styles.chargeLabel}>TVA totale:</Text>
              <Text style={[styles.chargeAmount, styles.vatAmount]}>
                {yearlyTotals.totalVAT.toFixed(2)} €
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total TTC:</Text>
            <Text style={styles.totalAmount}>
              {(yearlyTotals.totalHT + yearlyTotals.totalVAT).toFixed(2)} €
            </Text>
          </View>
        </View>
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
    paddingBottom: 32, 
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    marginTop: 20, 
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  monthCard: {
    backgroundColor: '#fff',
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 24, 
    borderRadius: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  monthHeader: {
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  validationDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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
  divider: {
    height: 1,
    backgroundColor: '#e5e5e5',
    marginVertical: 16,
  },
  vatRow: {
    marginTop: 8,
  },
  vatAmount: {
    color: '#FF9500',
  },
  highlightedAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  yearlyHeader: {
    marginTop: 32, // Plus d'espace avant la section annuelle
  },
  yearlyCard: {
    marginBottom: 32, // Plus d'espace après la dernière carte
  },
});