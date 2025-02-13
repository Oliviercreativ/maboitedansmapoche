import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface CompanyExpense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
}

const categories = [
  'Fournitures',
  'Services',
  'Loyer',
  'Assurance',
  'Marketing',
  'Déplacements',
  'Autres',
];

export default function CompanyScreen() {
  const [expenses, setExpenses] = useState<CompanyExpense[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [editingExpense, setEditingExpense] = useState<CompanyExpense | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const storedExpenses = await AsyncStorage.getItem('companyExpenses');
      if (storedExpenses) {
        setExpenses(JSON.parse(storedExpenses));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des frais:', error);
    }
  };

  const saveExpenses = async (newExpenses: CompanyExpense[]) => {
    try {
      await AsyncStorage.setItem('companyExpenses', JSON.stringify(newExpenses));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des frais:', error);
    }
  };

  const addExpense = () => {
    if (description.trim() && amount) {
      const newExpense: CompanyExpense = {
        id: Date.now().toString(),
        category,
        description: description.trim(),
        amount: parseFloat(amount),
        date: new Date().toISOString(),
      };
      const newExpenses = [...expenses, newExpense];
      setExpenses(newExpenses);
      saveExpenses(newExpenses);
      setDescription('');
      setAmount('');
    }
  };

  const startEditing = (expense: CompanyExpense) => {
    setEditingExpense(expense);
    setCategory(expense.category);
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setModalVisible(true);
  };

  const updateExpense = () => {
    if (editingExpense && description.trim() && amount) {
      const updatedExpenses = expenses.map(expense =>
        expense.id === editingExpense.id
          ? {
              ...expense,
              category,
              description: description.trim(),
              amount: parseFloat(amount),
            }
          : expense
      );
      setExpenses(updatedExpenses);
      saveExpenses(updatedExpenses);
      setModalVisible(false);
      setEditingExpense(null);
      setDescription('');
      setAmount('');
      setCategory(categories[0]);
    }
  };

  const deleteExpense = (id: string) => {
    const newExpenses = expenses.filter(expense => expense.id !== id);
    setExpenses(newExpenses);
    saveExpenses(newExpenses);
  };

  const deleteExpensesByCategory = (categoryToDelete: string) => {
    Alert.alert(
      'Confirmation',
      `Voulez-vous vraiment supprimer tous les frais de la catégorie "${categoryToDelete}" ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            const newExpenses = expenses.filter(expense => expense.category !== categoryToDelete);
            setExpenses(newExpenses);
            saveExpenses(newExpenses);
          },
        },
      ]
    );
  };

  const totalByCategory = categories.map(cat => ({
    category: cat,
    total: expenses
      .filter(expense => expense.category === cat)
      .reduce((sum, expense) => sum + expense.amount, 0),
  }));

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryButton,
                category === cat && styles.categoryButtonActive,
              ]}
              onPress={() => setCategory(cat)}>
              <Text
                style={[
                  styles.categoryButtonText,
                  category === cat && styles.categoryButtonTextActive,
                ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          placeholder="Montant"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={editingExpense ? updateExpense : addExpense}>
          <Text style={styles.addButtonText}>
            {editingExpense ? 'Modifier le frais' : 'Ajouter un frais'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Frais par catégorie</Text>
        {totalByCategory.map(({ category: cat, total }) => (
          <View key={cat} style={styles.summaryRow}>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryCategory}>{cat}</Text>
              <Text style={styles.summaryAmount}>{total.toFixed(2)} €</Text>
            </View>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total des frais:</Text>
          <Text style={styles.totalAmount}>{totalExpenses.toFixed(2)} €</Text>
        </View>
      </View>

      <ScrollView style={styles.expensesList}>
        {expenses.map((expense) => (
          <View key={expense.id} style={styles.expenseItem}>
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseCategory}>{expense.category}</Text>
              <Text style={styles.expenseDescription}>{expense.description}</Text>
              <Text style={styles.expenseAmount}>{expense.amount.toFixed(2)} €</Text>
              <Text style={styles.expenseDate}>
                {new Date(expense.date).toLocaleString('fr-FR')}
              </Text>
            </View>
            <View style={styles.expenseActions}>
              <TouchableOpacity
                onPress={() => startEditing(expense)}
                style={styles.editButton}>
                <Ionicons name="pencil-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteExpense(expense.id)}
                style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier le frais</Text>
            
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat)}>
                  <Text
                    style={[
                      styles.categoryButtonText,
                      category === cat && styles.categoryButtonTextActive,
                    ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.input}
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
            />
            <TextInput
              style={styles.input}
              placeholder="Montant"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setEditingExpense(null);
                  setDescription('');
                  setAmount('');
                  setCategory(categories[0]);
                }}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={updateExpense}>
                <Text style={styles.saveButtonText}>Enregistrer</Text>
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
  categoryScroll: {
    marginBottom: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    fontSize: 16,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
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
  summaryContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: 16,
  },
  summaryCategory: {
    fontSize: 14,
    color: '#8E8E93',
  },
  summaryAmount: {
    fontSize: 14,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  categoryDeleteButton: {
    padding: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  expensesList: {
    flex: 1,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseCategory: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  expenseDescription: {
    fontSize: 16,
    color: '#1c1c1e',
    marginBottom: 4,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  expenseDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  expenseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});