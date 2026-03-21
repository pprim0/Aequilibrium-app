import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';
import { sendTestNotification, cancelAllReminders } from '../utils/notifications';

// ── Dados de exemplo ──────────────────────────────────────

const stats = [
    { label: 'Hábitos ativos', value: '5' },
    { label: 'Streak atual', value: '🔥 6' },
    { label: 'Score', value: '82' },
];

const monthSummary = [
    { label: 'Poupança', value: '120€', sub: 'Meta: 300€', color: colors.success },
    { label: 'Gastos', value: '540€', sub: 'de 1.200€', color: colors.error },
    { label: 'Hábitos', value: '73%', sub: 'consistência', color: colors.primary },
];

const settingsGroups = [
    {
        title: 'Conta',
        items: [
            { emoji: '👤', label: 'Editar perfil', sub: 'Nome, foto, frase', arrow: true },
            { emoji: '🔔', label: 'Notificações', sub: 'Lembretes ativos', arrow: true },
            { emoji: '🔒', label: 'Privacidade', sub: 'Dados e segurança', arrow: true },
            { emoji: '🔔', label: 'Testar notificação', sub: 'Recebe um teste em 3 segundos', arrow: true, onPress: () => sendTestNotification({ emoji: '🌱', name: 'Momentum' }) },
            { emoji: '🔕', label: 'Cancelar todos os lembretes', sub: 'Remove notificações agendadas', arrow: true, danger: false, onPress: () => cancelAllReminders() },
        ],
    },
    {
        title: 'Preferências',
        items: [
            { emoji: '💶', label: 'Moeda', sub: 'Euro (€)', arrow: true },
            { emoji: '🌙', label: 'Tema escuro', toggle: true, value: false },
            { emoji: '📅', label: 'Início da semana', sub: 'Segunda-feira', arrow: true },
        ],
    },
    {
        title: 'Dados',
        items: [
            { emoji: '📤', label: 'Exportar dados', sub: 'CSV ou JSON', arrow: true },
            { emoji: '🗑️', label: 'Apagar conta', sub: 'Ação irreversível', arrow: true, danger: true },
        ],
    },
];

// ── Mini componentes ──────────────────────────────────────

function SettingsRow({ item }) {
    return (
        <TouchableOpacity
            style={[styles.settingsRow, item.danger && styles.settingsRowDanger]}
            onPress={item.onPress}
            activeOpacity={item.onPress ? 0.7 : 1}
        >
            <View style={[styles.settingsIcon, { backgroundColor: item.danger ? colors.errorPale : colors.bg }]}>
                <Text style={{ fontSize: 17 }}>{item.emoji}</Text>
            </View>
            <View style={styles.settingsText}>
                <Text style={[styles.settingsLabel, item.danger && { color: colors.error }]}>{item.label}</Text>
                {item.sub && <Text style={styles.settingsSub}>{item.sub}</Text>}
            </View>
            {item.arrow && <Text style={styles.chevron}>›</Text>}
            {item.toggle !== undefined && (
                <Switch
                    value={item.value}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                />
            )}
        </TouchableOpacity>
    );
}

// ── Screen principal ──────────────────────────────────────

export default function ProfileScreen() {
    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >

                {/* Profile card */}
                <View style={styles.profileCard}>
                    {/* Avatar */}
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>P</Text>
                        </View>
                        <TouchableOpacity style={styles.avatarEdit}>
                            <Text style={{ fontSize: 13 }}>✏️</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.profileName}>Pedro Ferreira</Text>
                    <Text style={styles.profileMotivation}>"Consistência vence intensidade."</Text>

                    {/* Stats row */}
                    <View style={styles.statsRow}>
                        {stats.map((s, i) => (
                            <View key={s.label} style={styles.statItem}>
                                <Text style={styles.statVal}>{s.value}</Text>
                                <Text style={styles.statLabel}>{s.label}</Text>
                                {i < stats.length - 1 && <View style={styles.statDivider} />}
                            </View>
                        ))}
                    </View>
                </View>

                {/* Mês em resumo */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Março 2025</Text>
                    <View style={styles.monthRow}>
                        {monthSummary.map(m => (
                            <View key={m.label} style={styles.monthStat}>
                                <Text style={[styles.monthVal, { color: m.color }]}>{m.value}</Text>
                                <Text style={styles.monthLabel}>{m.label}</Text>
                                <Text style={styles.monthSub}>{m.sub}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Metas ativas */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Metas ativas</Text>
                    <View style={styles.goalRow}>
                        <Text style={{ fontSize: 22 }}>✈️</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.goalName}>Viagem</Text>
                            <View style={styles.goalTrack}>
                                <View style={[styles.goalFill, { width: '36%' }]} />
                            </View>
                        </View>
                        <Text style={styles.goalPercent}>36%</Text>
                    </View>
                    <View style={[styles.goalRow, { marginTop: 10 }]}>
                        <Text style={{ fontSize: 22 }}>💻</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.goalName}>Novo portátil</Text>
                            <View style={styles.goalTrack}>
                                <View style={[styles.goalFill, { width: '84%', backgroundColor: colors.success }]} />
                            </View>
                        </View>
                        <Text style={[styles.goalPercent, { color: colors.success }]}>84%</Text>
                    </View>
                </View>

                {/* Settings groups */}
                {settingsGroups.map(group => (
                    <View key={group.title}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        <View style={styles.settingsCard}>
                            {group.items.map((item, i) => (
                                <View key={item.label}>
                                    <SettingsRow item={item} />
                                    {i < group.items.length - 1 && <View style={styles.settingsDivider} />}
                                </View>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7}>
                    <Text style={styles.logoutText}>🚪  Terminar sessão</Text>
                </TouchableOpacity>

                <Text style={styles.version}>Momentum v0.1.0 · Feito com 🌱</Text>

            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.md, gap: 12, paddingBottom: 40 },

    // Profile card
    profileCard: { backgroundColor: '#E8F5EE', borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', ...shadow.sm },
    avatarWrap: { position: 'relative', marginBottom: 12 },
    avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
    avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: '#fff' },
    avatarEdit: { position: 'absolute', bottom: 0, right: -4, width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.sm },
    profileName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: colors.text },
    profileMotivation: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: colors.primary, marginTop: 4, fontStyle: 'italic' },
    statsRow: { flexDirection: 'row', marginTop: 20, width: '100%' },
    statItem: { flex: 1, alignItems: 'center', position: 'relative' },
    statVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.text },
    statLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3, marginTop: 2, textAlign: 'center' },
    statDivider: { position: 'absolute', right: 0, top: '10%', height: '80%', width: 1, backgroundColor: 'rgba(0,0,0,0.08)' },

    // Card
    card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
    sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.text, marginBottom: 14 },

    // Month summary
    monthRow: { flexDirection: 'row' },
    monthStat: { flex: 1, alignItems: 'center' },
    monthVal: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18 },
    monthLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.text2, marginTop: 2 },
    monthSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: colors.text3, marginTop: 1 },

    // Goals
    goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    goalName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: colors.text, marginBottom: 6 },
    goalTrack: { height: 6, backgroundColor: colors.border, borderRadius: 100, overflow: 'hidden' },
    goalFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 100 },
    goalPercent: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.primary, width: 36, textAlign: 'right' },

    // Settings
    groupTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
    settingsCard: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, ...shadow.sm },
    settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
    settingsRowDanger: {},
    settingsIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    settingsText: { flex: 1 },
    settingsLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: colors.text },
    settingsSub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, marginTop: 1 },
    chevron: { fontSize: 20, color: colors.text3 },
    settingsDivider: { height: 1, backgroundColor: colors.border },

    // Logout
    logoutBtn: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', ...shadow.sm },
    logoutText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: colors.error },

    version: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: colors.text3, textAlign: 'center', marginTop: 4 },
});