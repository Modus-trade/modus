import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { api, type Ticket } from '@/api';
import { Card, Empty, ErrorBanner, Loading, SectionTitle, TicketList, styles } from '@/components';
import { useData } from '@/useData';

export default function Search() {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recent = useData(() => api.tickets({ sort: 'updated_at' }).then((r) => r.items.slice(0, 8)), [], 'recent');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (!query) return setResults(null);
    let alive = true;
    api
      .tickets({ q: query })
      .then((r) => alive && (setResults(r.items), setError(null)))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [query]);

  return (
    <>
      <Stack.SearchBar placeholder="Номер, тема или текст обращения" onChangeText={(e) => setText(e.nativeEvent.text)} onCancelButtonPress={() => setText('')} />
      <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
        {error ? <ErrorBanner message={error} /> : null}
        {query ? (
          results === null ? (
            <Loading />
          ) : results.length ? (
            <>
              <SectionTitle>{`Найдено: ${results.length}`}</SectionTitle>
              <TicketList tickets={results} />
            </>
          ) : (
            <Empty icon="magnifyingglass" title={`Ничего не найдено по «${query}»`} text="Попробуйте другое слово из темы или описания." />
          )
        ) : (
          <>
            <SectionTitle>Недавние</SectionTitle>
            {recent.data ? (
              recent.data.length ? (
                <TicketList tickets={recent.data} />
              ) : (
                <Card>
                  <Empty icon="tray" title="Обращений пока нет" />
                </Card>
              )
            ) : (
              <Loading />
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}
