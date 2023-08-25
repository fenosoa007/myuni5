// import * as https from 'https';
import axios from 'axios';
import { endOfWeek, startOfWeek } from 'date-fns';

type RawStudyDateDetail = {
  startDate: string;
  endDate?: string;
  'jcr:title': string;
  tags: string[];
};

type Week = {
  start: string;
  end: string;
  name: string;
};

type SessionDateRange = {
  startDate: string;
  endDate: string;
  title: string;
};

type StudyDatesResponse = Record<string, RawStudyDateDetail>;

const endOfStudyWeek = (date: Date) => endOfWeek(date, { weekStartsOn: 1 });
const startOfStudyWeek = (date: Date) => startOfWeek(date, { weekStartsOn: 1 });

const getYearIdNameFromSessionDateTitle = (detail: RawStudyDateDetail) => {
  const { 'jcr:title': title, startDate } = detail;
  const id = title.match(/\((S|s)\d.*\)/i);
  const name = title.split('(')[0];
  return {
    id: id ? id[0].substring(1, id[0].length - 1) : '',
    name,
    year: new Date(startDate).getUTCFullYear(),
  };
};

const getYearAndIdFromKey = (key: string) => {
  const keyParts: string[] = key.split('-');
  const year = keyParts[0];
  const id = keyParts[1].toUpperCase();
  return { year, id };
};

const getTeachingDatesFromStudyDates = (studyDates: StudyDatesResponse) => {
  const compiledDates: Record<string, SessionDateRange> = {};
  const specialWeeks: Record<string, SessionDateRange[]> = {};
  const studyDatesArray = Object.entries(studyDates);

  // Teaching dates usually has the year and session code in the key
  // Example key of a teaching date item: "2022-s2cioc-teaching-dates"
  // They also have "Session Dates" filter tag
  // TODO: add extraction using filter tags or title instead
  const sessionNames: Record<string, string> = {};
  const sessionIds: Record<string, string> = {};
  studyDatesArray
    .filter(
      ([_, value]) =>
        value.tags.includes('Student website : Filter by... / Session dates') &&
        value.endDate,
    )
    .forEach(([_, detail]) => {
      const { year, id, name } = getYearIdNameFromSessionDateTitle(detail);
      const { startDate, endDate, 'jcr:title': title } = detail;
      compiledDates[`${year}-${id}`] = {
        startDate,
        endDate,
        title,
      } as SessionDateRange;
      sessionNames[`${year}-${id}`] = name;
      sessionIds[name.toLowerCase().trim()] = id;
    });

  // STUVAC, breaks, and exam periods are pretty much only for S1C and S2C (main semester 1 and 2)
  // They don't have consistent keys, so we need to determine the semester by the title.
  // Example title: Mid-semester break (Semester 1), STUVAC (Semester 1), Exam period (Semester 1)
  studyDatesArray
    .filter(([_, detail]) => {
      const lowerTitle = detail['jcr:title'].toLowerCase();
      return (
        lowerTitle.includes('stuvac') ||
        lowerTitle.includes('break') ||
        lowerTitle.startsWith('exam period')
      );
    })
    .forEach(([key, value]) => {
      let year = '';
      let id = '';
      // let name = "";
      const { startDate, endDate, 'jcr:title': title } = value;
      const idStringIndex = title.indexOf('(');
      const name = title.substring(0, idStringIndex).trim();
      if (value['jcr:title'].toLowerCase().startsWith('exam period')) {
        year = key.split('-')[0];
        const sessionName = title.substring(
          idStringIndex + 1,
          title.indexOf(')'),
        );
        id = sessionIds[sessionName.toLowerCase()];
      } else {
        const yearAndId = getYearAndIdFromKey(key);
        year = yearAndId.year;
        id = yearAndId.id;
      }
      // const {startDate, endDate, "jcr:title":title} = value
      if (specialWeeks[`${year}-${id}`] === undefined) {
        specialWeeks[`${year}-${id}`] = [];
      }
      specialWeeks[`${year}-${id}`].push({
        startDate,
        endDate,
        title: name,
      } as SessionDateRange);
    });
  // console.log(specialWeeks);

  Object.keys(specialWeeks).forEach((key) =>
    specialWeeks[key].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
  );
  // console.log(sessionNames);

  return { teachingDates: compiledDates, specialWeeks, sessionNames };
};

const getWeeksFromTeachingDates = (
  sessionYearAndId: string[],
  teachingDates: Record<string, SessionDateRange>,
  specialWeeks: Record<string, SessionDateRange[]>,
  sessionNames: Record<string, string>,
) => {
  const sessionWeeks: Record<string, { name: string; weeks: Week[] }> = {};
  sessionYearAndId.forEach((yearAndId) => {
    const upperCaseYearId = yearAndId.toUpperCase();
    if (!teachingDates[upperCaseYearId]) {
      console.log(`Session ${upperCaseYearId} not found`);
      return;
    }
    const weeks: Week[] = [];
    const sessionEnd = endOfStudyWeek(
      new Date(teachingDates[upperCaseYearId].endDate),
    );

    var start = startOfStudyWeek(
      new Date(teachingDates[upperCaseYearId].startDate),
    );
    var end = endOfStudyWeek(start);

    let specialWeeksIndex = 0;
    let weekCount = 1;
    const addWeek = (start: Date, end: Date, name: string) => {
      weeks.push({ start: start.toISOString(), end: end.toISOString(), name });
      weekCount++;
    };
    while (start < sessionEnd) {
      if (
        specialWeeks[upperCaseYearId] &&
        specialWeeksIndex < specialWeeks[upperCaseYearId].length
      ) {
        console.log(specialWeeks[upperCaseYearId]);

        const specialWeekStart = startOfStudyWeek(
          new Date(specialWeeks[upperCaseYearId][specialWeeksIndex].startDate),
        );
        const specialWeekEnd = endOfStudyWeek(
          new Date(specialWeeks[upperCaseYearId][specialWeeksIndex].endDate),
        );
        if (
          (start <= specialWeekStart && end >= specialWeekEnd) ||
          (start >= specialWeekStart && end <= specialWeekEnd)
        ) {
          addWeek(
            start,
            end,
            specialWeeks[upperCaseYearId][specialWeeksIndex].title.replace(
              / \(.*\)/,
              '',
            ),
          );
          if (end >= specialWeekEnd) {
            specialWeeksIndex++;
          }
        } else {
          addWeek(start, end, `Week ${weekCount}`);
        }
      } else {
        addWeek(start, end, `Week ${weekCount}`);
      }
      start.setDate(start.getDate() + 7);
      end.setDate(end.getDate() + 7);
    }
    sessionWeeks[yearAndId] = { name: sessionNames[yearAndId], weeks };
  });
  return sessionWeeks;
};

export class StudyDatesService {
  getStudyWeeks(sessionYearAndId: string[] = []) {
    const endpoint = 'https://www.sydney.edu.au/bin/students/dates/l/dl.json';
    return axios
      .get<StudyDatesResponse>(endpoint)
      .then(({ data }) => {
        const { teachingDates, specialWeeks, sessionNames } =
          getTeachingDatesFromStudyDates(data);
        const weeks = getWeeksFromTeachingDates(
          sessionYearAndId,
          teachingDates,
          specialWeeks,
          sessionNames,
        );
        return weeks;
      })
      .catch(function (error) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.log(error.response.data);
          console.log(error.response.status);
          console.log(error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.log(error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message, error.stack);
        }
        console.log(error.config);
      });
  }
}
