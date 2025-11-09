import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { Bell, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SubmittingModal from '@/components/SubmittingModal';

type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  date: string;
  read: boolean;
  actionType?: 'advance' | 'leave' | 'deduction' | 'payment' | 'absence';
  actionId?: string;
};

export default function NotificationsScreen() {
  const { user: authUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // جلب الإشعارات
  const fetchNotifications = async () => {
    if (!authUser) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .order('date', { ascending: false });

      if (error) throw error;

      setNotifications(data as Notification[]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // تعليم جميع الإشعارات كمقروءة
  const markAllAsRead = async () => {
    if (!authUser || notifications.length === 0) return;

    const unreadIds = notifications
      .filter(n => !n.read)
      .map(n => n.id);

    if (unreadIds.length === 0) return;

    setIsMarkingAsRead(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds);

      if (error) throw error;

      // تحديث الحالة محليًا
      setNotifications(prev =>
        prev.map(n => (unreadIds.includes(n.id) ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    } finally {
      setIsMarkingAsRead(false);
    }
  };

  // عند فتح الشاشة: جلب + تعليم كمقروءة
  useEffect(() => {
    if (authUser) {
      fetchNotifications();
    }
  }, [authUser]);

  // عند التمرير لأسفل للتحديث
  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  // عند فتح الشاشة، إذا كانت هناك إشعارات غير مقروءة → علّمها
  useEffect(() => {
    if (notifications.length > 0) {
      const hasUnread = notifications.some(n => !n.read);
      if (hasUnread) {
        markAllAsRead();
      }
    }
  }, [notifications]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={24} color={Colors.success} />;
      case 'warning':
        return <AlertCircle size={24} color={Colors.warning} />;
      case 'danger':
        return <XCircle size={24} color={Colors.danger} />;
      default:
        return <Info size={24} color={Colors.primary} />;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'الإشعارات', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'الإشعارات',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' as const },
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Bell size={64} color={Colors.textLight} />
            <Text style={styles.emptyText}>لا توجد إشعارات</Text>
          </View>
        ) : (
          notifications.map(notification => (
            <TouchableOpacity
              key={notification.id}
              style={[styles.notificationCard, styles.unreadCard]}
              onPress={() => {}}
            >
              <View style={styles.notificationIcon}>{getIcon(notification.type)}</View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationDate}>
                  {new Date(notification.date).toLocaleString('ar-EG')}
                </Text>
              </View>
              <View style={styles.unreadDot} />
            </TouchableOpacity>
          ))
        )}


      </ScrollView>
      <SubmittingModal visible={isMarkingAsRead} message="جاري التحديث..." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textLight,
    marginTop: 16,
  },
  notificationCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  notificationIcon: {
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  notificationDate: {
    fontSize: 12,
    color: Colors.textLight,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },

});
