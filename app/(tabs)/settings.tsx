import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QRCodeSVG } from 'qrcode.react';

interface CompanySettings {
  regime: 'BIC' | 'BNC';
  isVATEnabled: boolean;
  hasLiberatoryTax: boolean;
  urssafRate: number;
}

const DEFAULT_SETTINGS: CompanySettings = {
  regime: 'BNC',
  isVATEnabled: false,
  hasLiberatoryTax: false,
  urssafRate: 23.1,
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [url, setUrl] = useState('');
  const [urssafRateInput, setUrssafRateInput] = useState(DEFAULT_SETTINGS.urssafRate.toString());

  useEffect(() => {
    loadSettings();
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => {
        try {
          const currentUrl = window.location.href || '';
          setUrl(currentUrl);
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'URL:', error);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('companySettings');
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        // Fusionner avec les paramètres par défaut pour s'assurer que tous les champs existent
        const mergedSettings = { ...DEFAULT_SETTINGS, ...parsedSettings };
        setSettings(mergedSettings);
        setUrssafRateInput(mergedSettings.urssafRate.toString());
      } else {
        // Si aucun paramètre n'est stocké, initialiser avec les valeurs par défaut
        await saveSettings(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
      // En cas d'erreur, utiliser les paramètres par défaut
      setSettings(DEFAULT_SETTINGS);
      setUrssafRateInput(DEFAULT_SETTINGS.urssafRate.toString());
    }
  };

  const saveSettings = async (newSettings: CompanySettings) => {
    try {
      await AsyncStorage.setItem('companySettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des paramètres:', error);
    }
  };

  const toggleRegime = () => {
    const newSettings = {
      ...settings,
      regime: settings.regime === 'BIC' ? 'BNC' : 'BIC',
    };
    saveSettings(newSettings);
  };

  const toggleVAT = () => {
    const newSettings = {
      ...settings,
      isVATEnabled: !settings.isVATEnabled,
    };
    saveSettings(newSettings);
  };

  const toggleLiberatoryTax = () => {
    const newSettings = {
      ...settings,
      hasLiberatoryTax: !settings.hasLiberatoryTax,
    };
    saveSettings(newSettings);
  };

  const updateUrssafRate = (value: string) => {
    const numericValue = parseFloat(value) || DEFAULT_SETTINGS.urssafRate;
    setUrssafRateInput(value);
    const newSettings = {
      ...settings,
      urssafRate: numericValue,
    };
    saveSettings(newSettings);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paramètres de l'entreprise</Text>
        
        <View style={styles.card}>
          <View style={styles.settingItem}>
            <View>
              <Text style={styles.settingTitle}>Régime fiscal</Text>
              <Text style={styles.settingDescription}>
                {settings.regime === 'BIC' ? 'Bénéfices Industriels et Commerciaux' : 'Bénéfices Non Commerciaux'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.regimeButton,
                settings.regime === 'BIC' ? styles.regimeButtonActive : null,
              ]}
              onPress={toggleRegime}>
              <Text style={[
                styles.regimeButtonText,
                settings.regime === 'BIC' && styles.regimeButtonTextActive,
              ]}>
                {settings.regime}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.separator} />

          <View style={styles.settingItem}>
            <View>
              <Text style={styles.settingTitle}>TVA</Text>
              <Text style={styles.settingDescription}>
                {settings.isVATEnabled ? 'Assujetti à la TVA' : 'Non assujetti à la TVA'}
              </Text>
            </View>
            <Switch
              value={settings.isVATEnabled}
              onValueChange={toggleVAT}
              trackColor={{ false: '#e5e5e5', true: '#007AFF' }}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.settingItem}>
            <View>
              <Text style={styles.settingTitle}>Impôt libératoire</Text>
              <Text style={styles.settingDescription}>
                {settings.hasLiberatoryTax ? 'Versement libératoire activé' : 'Versement libératoire désactivé'}
              </Text>
            </View>
            <Switch
              value={settings.hasLiberatoryTax}
              onValueChange={toggleLiberatoryTax}
              trackColor={{ false: '#e5e5e5', true: '#007AFF' }}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.settingItem}>
            <View>
              <Text style={styles.settingTitle}>Taux URSSAF</Text>
              <Text style={styles.settingDescription}>
                Taux appliqué sur le CA mensuel
              </Text>
            </View>
            <View style={styles.urssafInputContainer}>
              <TextInput
                style={styles.urssafInput}
                value={urssafRateInput}
                onChangeText={updateUrssafRate}
                keyboardType="numeric"
                placeholder="23.1"
              />
              <Text style={styles.percentageText}>%</Text>
            </View>
          </View>
        </View>
      </View>

      {Platform.OS === 'web' && url && (
        <View style={styles.qrSection}>
          <Text style={styles.qrTitle}>Scanner pour tester sur mobile</Text>
          <View style={styles.qrContainer}>
            <QRCodeSVG value={url} size={200} />
          </View>
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Informations</Text>
        
        {settings.regime === 'BIC' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoHeader}>Régime BIC</Text>
            <Text style={styles.infoText}>
              Le régime des BIC s'applique aux activités commerciales, industrielles et artisanales.
            </Text>
          </View>
        )}

        {settings.regime === 'BNC' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoHeader}>Régime BNC</Text>
            <Text style={styles.infoText}>
              Le régime des BNC s'applique aux professions libérales et aux activités non commerciales.
            </Text>
          </View>
        )}

        {settings.isVATEnabled && (
          <View style={styles.infoCard}>
            <Text style={styles.infoHeader}>TVA</Text>
            <Text style={styles.infoText}>
              En tant qu'assujetti à la TVA, vous devez collecter la TVA sur vos ventes et pouvez déduire la TVA sur vos achats.
            </Text>
          </View>
        )}

        {settings.hasLiberatoryTax && (
          <View style={styles.infoCard}>
            <Text style={styles.infoHeader}>Versement libératoire</Text>
            <Text style={styles.infoText}>
              Le versement libératoire permet de payer l'impôt sur le revenu en même temps que les charges sociales.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e5e5',
    marginVertical: 12,
  },
  regimeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  regimeButtonActive: {
    backgroundColor: '#007AFF',
  },
  regimeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  regimeButtonTextActive: {
    color: '#ffffff',
  },
  urssafInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  urssafInput: {
    fontSize: 16,
    color: '#1c1c1e',
    width: 60,
    textAlign: 'right',
    paddingVertical: 8,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  percentageText: {
    fontSize: 16,
    color: '#1c1c1e',
    marginLeft: 4,
  },
  qrSection: {
    padding: 16,
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 16,
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  infoSection: {
    padding: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  infoHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
});