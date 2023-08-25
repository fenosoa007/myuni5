import axios from 'axios';
import * as https from 'https';
import AWS from 'aws-sdk';
import * as soap from 'soap';

// TODO: SOAP to courses is still WIP
const COURSES_WSDL_PATH = __dirname + '/wsdl/CoursesService.wsdl';
const COURSES_SOAP_ENDPOINT =
  'https://uat.api.sydney.edu.au/usyd-enrolment-soap-exp-api-v1-0/SITSEnrolmentDetailsService/EnrolmentDetailsServicePortTypeEndpoint';

// reuse the following while lambda is hot
let ssm: AWS.SSM | undefined;
let studentUrl: string | undefined;
let studentUsername: string | undefined;
let studentPassword: string | undefined;
let mulesoftCertificate: string | undefined;
let mulesoftKey: string | undefined;

export class MulesoftStudentService {
  addParamPromise(tasks: any[], key?: string, decrypt?: boolean) {
    if (ssm) {
      tasks.push(
        ssm
          .getParameter({
            Name: key ?? '',
            WithDecryption: decrypt,
          })
          .promise(),
      );
    }
  }

  async hydrateParams() {
    if (!ssm) {
      try {
        ssm = new AWS.SSM();
        const tasks: any[] = [];
        this.addParamPromise(tasks, process.env.PARAMETER_STUDENT_API_URL);
        this.addParamPromise(tasks, process.env.PARAMETER_STUDENT_API_USERNAME);
        this.addParamPromise(
          tasks,
          process.env.PARAMETER_STUDENT_API_PASSWORD,
          true,
        );
        this.addParamPromise(tasks, process.env.PARAMETER_MULESOFT_CERTIFICATE);
        this.addParamPromise(
          tasks,
          process.env.PARAMETER_MULESOFT_PRIVATE_KEY,
          true,
        );
        const result = await Promise.all(tasks);
        studentUrl = result[0].Parameter?.Value;
        studentUsername = result[1].Parameter?.Value;
        studentPassword = result[2].Parameter?.Value;
        mulesoftCertificate = result[3].Parameter?.Value;
        mulesoftKey = result[4].Parameter?.Value;
      } catch (err) {
        console.log('### Error getting SSM Params');
        console.log(err);
      }
    }
  }

  async buildSoapClient(wsdl: string) {
    // TODO: get below working. Getting all kinds of 501 etc. No doubt related to two-way ssl and basic auth.
    // const auth = {
    //   username: studentUsername || '',
    //   password: studentPassword || '',
    // };
    // const cert = mulesoftCertificate;
    // const key = mulesoftKey;
    // const options = {
    //   cert,
    //   key,
    //   rejectUnauthorized: false,
    // };
    // const httpsAgent = new https.Agent(options);

    // const res = await axios.get(wsdl, { auth, httpsAgent });
    // const res = await axios.get(wsdl, { httpsAgent });
    // const res = await axios.get(wsdl);
    // console.log(res.status, res.data);
    // console.log(res);

    // const client = await soap.createClientAsync(wsdl, {
    //   wsdl_options: { auth, httpsAgent },
    // });
    const client = await soap.createClientAsync(wsdl, {
      endpoint: COURSES_SOAP_ENDPOINT,
    });
    // client.setSecurity(
    //   new soap.ClientSSLSecurity(
    //     mulesoftKey ?? '',
    //     mulesoftCertificate ?? '',
    //     null,
    //     {
    //       rejectUnauthorized: false,
    //     },
    //   ),
    // );
    return client;
  }

  async getDegrees(studentId: string | number) {
    await this.hydrateParams();
    const enrolmentDetails = await this.getStudentEnrolmentDetails(studentId);
    const activeEnrolments = this.getCourseEnrolments(enrolmentDetails);
    return {
      data: activeEnrolments.map((e: any) =>
        this.getStudentDegreeFromCourseEnrolment(e),
      ),
      status: 200,
    };
  }

  async getStudentEnrolmentDetails(studentId: string | number) {
    const endpoint = `${studentUrl}/v1/students/enrolment/list?SID=${studentId}`;
    const auth = {
      username: studentUsername || '',
      password: studentPassword || '',
    };
    const cert = mulesoftCertificate;
    const key = mulesoftKey;
    const options = {
      cert,
      key,
      rejectUnauthorized: false,
    };
    const httpsAgent = new https.Agent(options);
    const res = await axios.get(endpoint, { auth, httpsAgent });
    if (res.status !== 200) {
      return {
        data: 'Unable to fetch student enrolment',
        status: res.status,
      };
    }
    if (!res.data.students) {
      return {
        data: 'Could not find any data for studentId',
        status: 500,
      };
    }
    return res.data.students && res.data.students.length > 0
      ? res.data.students[0]
      : null;
  }

  getCourseEnrolments(student: any) {
    const enrolments = student.courseEnrolments;
    let enrolmentsCS: any[] = [];
    enrolments.forEach((e: any) => {
      if (e.enrolmentStatus === 'CS') {
        enrolmentsCS.unshift(e);
      }
    });
    return enrolmentsCS;
  }

  getStudentDegreeFromCourseEnrolment(enrolment: any) {
    const yearlyEnrolments = enrolment.yearlyEnrolments;
    const unitsOfStudy = this.hideUnreleasedResults(
      this.unitsOfStudyFromYearlyEnrolments(yearlyEnrolments),
    );
    let major = '-';
    const pathway = enrolment.pathway;
    if (pathway && pathway.length > 0) {
      // TODO: need to check this against real data, unable to validate propert names
      major = pathway[0].pathwayDescription ?? '-';
    }
    return {
      name: `${this.parseDegreeStatus(enrolment)}, ${enrolment.courseName}`,
      minor: '-',
      major,
      periods: this.sortPeriods(this.periods(unitsOfStudy, yearlyEnrolments)),
      route: enrolment.route,
      enrolmentStatus: enrolment.enrolmentStatus,
    };
  }

  hideUnreleasedResults(unitsOfStudy: any[]) {
    return unitsOfStudy.map((u: any) => {
      if (u.academicYear === new Date().getFullYear()) {
        u.status = 'UNRELEASED';
        u.creditedPoints = '';
      }
      return u;
    });
  }

  unitsOfStudyFromYearlyEnrolments(yearlyEnrolments: any[]) {
    const nestedArrayUnitsOfStudy = yearlyEnrolments.map((y: any) => {
      if (y.uosEnrolments) {
        return this.unitsOfStudyFromUOS_Enrolments(
          y.uosEnrolments,
          y.academicYear,
        );
      }
      return [];
    });
    return nestedArrayUnitsOfStudy.flat();
  }

  unitsOfStudyFromUOS_Enrolments(uosEnrolments: any[], academicYear: number) {
    return uosEnrolments.map((u: any) => {
      return {
        code: u.uosAlpha,
        name: u.uosName,
        type: u.deliveryModeDescription,
        status: this.uosStatus(u.enrolmentStatusAliasDescription),
        creditPoints:
          u.enrolmentStatusAliasDescription !== 'Withdrawn'
            ? u.pointsAttempted.toString()
            : '0',
        academicYear,
        sessionId: u.sessionId,
        sessionIdDesc: u.sessionIdDescription,
        semesterId: this.getSessionSemester(u.sessionId),
        periodName: this.periodName(u.sessionId, academicYear),
        periodOrder: this.periodOrder(u.sessionId, academicYear),
      };
    });
  }

  uosStatus(status: string) {
    if (status == 'Normal Completion') {
      return 'COMPLETED';
    } else if (status == 'Currently enrolled student') {
      return 'IN PROGRESS';
    } else {
      return status.toString();
    }
  }

  getSessionSemester(sessionId: string) {
    if (sessionId == 'S1C' || sessionId == 'S1CRA' || sessionId == 'S1CRB') {
      return 1;
    } else if (
      sessionId == 'S2C' ||
      sessionId == 'S2CRA' ||
      sessionId == 'S2CRB'
    ) {
      return 2;
    } else {
      return null;
    }
  }

  periodName(sessionId: string, year: number) {
    if (sessionId == 'S1C' || sessionId == 'S1CRA' || sessionId == 'S1CRB') {
      return `Enrolment Year ${year} - Semester 1`;
    } else if (
      sessionId == 'S2C' ||
      sessionId == 'S2CRA' ||
      sessionId == 'S2CRB'
    ) {
      return `Enrolment Year ${year} - Semester 2`;
    } else if (this.isIntensiveSession(sessionId)) {
      return `Enrolment Year ${year} - Intensive`;
    } else {
      return `Enrolment Year ${year} - ${sessionId}`;
    }
  }

  periodOrder(sessionId: string, year: number) {
    if (sessionId == 'S1C' || sessionId == 'S1CRA' || sessionId == 'S1CRB') {
      return year * 1000 + 1;
    } else if (
      sessionId == 'S2C' ||
      sessionId == 'S2CRA' ||
      sessionId == 'S2CRB'
    ) {
      return year * 1000 + 2;
    } else if (this.isIntensiveSession(sessionId)) {
      return year * 1000 + 100 + sessionId.replace(/\D/g, '');
    } else {
      return year * 1000 + sessionId.replace(/\D/g, '');
    }
  }

  isIntensiveSession(sessionId: string) {
    return sessionId.match('/S.CI.*/');
  }

  parseDegreeStatus(enrolment: any) {
    let degreeStatus = null;
    switch (enrolment.courseType) {
      case 'PC':
        // "Postgraduate Coursework"
        degreeStatus = 'Postgraduate';
        break;
      case 'PR':
        // Postgraduate Research
        degreeStatus = 'Postgraduate';
        break;
      case 'UC':
        // Undergraduate Coursework
        degreeStatus = 'Undergraduate';
        break;
    }

    return degreeStatus;
  }

  sortPeriods(periods: any[]) {
    return periods.sort((a: any, b: any) => {
      if (a['order'] === b['order']) {
        return 0;
      }
      return a['order'] > b['order'] ? -1 : 1;
    });
  }

  periods(unitsOfStudy: any[], yearlyEnrolments: any[]) {
    const periods: any[] = [];
    unitsOfStudy.forEach((u: any) => {
      const i = this.findPeriodInArray(periods, u.periodName);

      if (i !== -1) {
        // add unit of study to period
        periods[i].unitsOfStudy.push(u);
        periods[i].totalCreaditPoints += parseInt(u.creditPoints);
      } else {
        // create new period
        const period: { [key: string]: any } = {};
        period['name'] = u.periodName;
        if (u.semesterId) {
          const semester = this.findSemester(
            yearlyEnrolments,
            u.academicYear,
            u.semesterId,
          );
          if (semester) {
            if (semester.semesterStartDate) {
              period['from'] = semester.semesterStartDate;
            } else {
              period['from'] = '--';
              if (semester.semesterStatusDate !== '1900-01-01') {
                period['to'] = semester.semesterStatusDate;
              }
            }
            period['unitsOfStudy'] = [u];
            period['totalCreaditPoints'] = parseInt(u.creditPoints);
            period['order'] = u.periodOrder;
            periods.push(period);
          }
        }
      }
    });
    return periods;
  }

  findPeriodInArray(periods: any[], periodName: string) {
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      if (period && period.name === periodName) {
        return i;
      }
    }
    return -1;
  }

  findSemester(
    yearlyEnrolments: any[],
    year: number,
    semesterId: number,
  ): any | null {
    for (let i = 0; i < yearlyEnrolments.length; i++) {
      const yearlyEnrolment = yearlyEnrolments[i];
      if (yearlyEnrolment.academicYear === year) {
        if (yearlyEnrolment.semesterEnrolments) {
          const semesterEnrolments = yearlyEnrolment.semesterEnrolments;
          for (let n = 0; n < semesterEnrolments.length; n++) {
            const semesterEnrolment = semesterEnrolments[n];
            if (parseInt(semesterEnrolment.semesterId) === semesterId) {
              return semesterEnrolment;
            }
          }
          console.log(`Semester not found ${year} ${semesterId}`);
          return null;
        }
      }
    }
    throw new Error(`Semester not found ${year} ${semesterId}`);
  }

  async getCredits(studentId: string | number) {
    await this.hydrateParams();
    const enrolmentDetails = await this.getStudentEnrolmentDetails(studentId);
    const currentCourses =
      this.getCurrentYearEnrolmentDetailsArray(enrolmentDetails);
    const tasks = currentCourses.map(
      async (c: any) => await this.getCreditsForCurrentCourse(c),
    );
    const currentCourseCreditData = await Promise.all(tasks);
    return {
      data: currentCourseCreditData,
      status: 200,
    };
  }

  getCurrentYearEnrolmentDetailsArray(enrolmentDetails: any) {
    const courseEnrolments = enrolmentDetails.courseEnrolments
      .map((enrolment: any) => enrolment)
      .filter((enrolment: any) => enrolment.enrolmentStatus === 'CS');
    return courseEnrolments;
  }

  async getCreditsForCurrentCourse(currentCourse: any) {
    const result: { courseTotalCredits: number | null; yearlyData: any[] } = {
      courseTotalCredits: null,
      yearlyData: [],
    };
    result.courseTotalCredits = await this.totalCourseCredits(
      currentCourse.route,
    );
    const yearlyData: any[] = [];
    currentCourse.yearlyEnrolments.forEach((yearlyEnrolment: any) => {
      const yearData = {
        year: yearlyEnrolment.academicYear,
        currentCredits: null,
        totalCredits: 0,
      };
      if (yearlyEnrolment.uosEnrolments) {
        yearlyEnrolment.uosEnrolments.forEach((e: any) => {
          // yearData.currentCredits += e.pointsCredited;
          yearData.totalCredits += e.pointsAttempted;
        });
      }
      yearlyData.push(yearData);
    });
    result.yearlyData = yearlyData;
    return result;
  }

  async totalCourseCredits(routeCode: string) {
    const client = await this.buildSoapClient(COURSES_WSDL_PATH);
    // First call getCourseRouteElements to get the publication code
    const courseRouteParams = {
      publicationCode: '',
      routeCode,
      pathwayCode: '',
      academicYear: '',
      lastModifiedDate: '',
      startRecord: '1',
      numberOfRecords: '50',
    };
    const courseRouteResponse = await client.getCourseRouteElementsAsync(
      courseRouteParams,
    );
    console.log('### courseRouteResponse', courseRouteResponse);
    const publicationCode =
      courseRouteResponse.result.publication.publicationCode;
    // Then call getCourses to get the total credits for course given the publication code
    const courseParams = {
      publicationCode,
      inUse: '',
      isPublishable: '',
      department: '',
      faculty: '',
      lastModifiedDate: '',
      startRecord: '1',
      numberOfRecords: '50',
    };
    const courseResponse = await client.getCourseRouteElementsAsync(
      courseParams,
    );
    const credits = courseResponse.result.course.courseCreditPts;
    return credits;
  }

  async getStudentInfo(studentId: string | number) {
    await this.hydrateParams();
    const studentInfo = await this.getStudentInfoArray(studentId);
    return {
      data: studentInfo,
      status: 200,
    };
  }

  async getStudentInfoArray(studentId: string | number) {
    const enrolmentDetails = await this.getStudentEnrolmentDetails(studentId);
    const currentCourses =
      this.getCurrentYearEnrolmentDetailsArray(enrolmentDetails);
    return currentCourses.map((c: any) =>
      this.getStudentInfoItem(c, enrolmentDetails),
    );
  }

  getStudentInfoItem(currentCourse: any, enrolmentDetails: any) {
    const enrolmentInfoArray: any[] = this.getEnrolmentInfoArray(currentCourse);
    const item: any = {};
    item.campus = '';
    item.campusDescription = '';
    this.fillCampusDescription(item, currentCourse);
    item.name = `${enrolmentDetails.titleDescription} ${enrolmentDetails.officialName}`;
    item.academics = {};
    item.academics.degree = currentCourse.courseName;
    item.academics.major = this.parseAcademicMajor(currentCourse);
    item.academics.enrolmentInfo = enrolmentInfoArray[0];
    item.academics.enrolmentStatus = enrolmentInfoArray[1];
    item.academics.status = this.parseDegreeStatus(currentCourse);
    item.academics.route = currentCourse.route;
    // TODO Pending add it from USYD
    item.academics.minor = '';
    return item;
  }

  getEnrolmentInfoArray(currentCourse: any) {
    const yearlyEnrolments = currentCourse.yearlyEnrolments;
    for (let i = 0; i < yearlyEnrolments.length; i++) {
      const yearlyEnrolmentItem = yearlyEnrolments[i];
      const semesterEnrolments = yearlyEnrolmentItem.semesterEnrolments;
      const infoArray = this.getEnrolmentInfoFromSemester(
        semesterEnrolments,
        yearlyEnrolmentItem,
      );
      if (infoArray) {
        return infoArray;
      }
    }
    return [];
  }

  getEnrolmentInfoFromSemester(
    semesterEnrolments: any[],
    yearlyEnrolment: any,
  ) {
    for (let i = 0; i < semesterEnrolments.length; i++) {
      const semesterEnrolmentItem = semesterEnrolments[i];
      if (semesterEnrolmentItem.semesterStatus === 'CS') {
        return this.buildEnrolmentInfoArray(
          semesterEnrolmentItem,
          yearlyEnrolment,
        );
      }
    }
    return null;
  }

  buildEnrolmentInfoArray(semesterEnrolment: any, yearlyEnrolment: any) {
    const enrolmentInfo = `Enrolment Year ${yearlyEnrolment.academicYear}, Semester ${semesterEnrolment.semesterId}`;
    const enrolmentStatus =
      semesterEnrolment.attendancePattern.indexOf('FT') === -1
        ? 'Part time'
        : 'Full time';
    return [enrolmentInfo, enrolmentStatus];
  }

  fillCampusDescription(item: any, currentCourse: any) {
    const yearlyEnrolments = currentCourse.yearlyEnrolments;
    if (yearlyEnrolments && yearlyEnrolments.length > 0) {
      const yearlyEnrolment = yearlyEnrolments[0];
      const uosEnrolments = yearlyEnrolment.uosEnrolments;
      if (uosEnrolments && uosEnrolments.length > 0) {
        item.campus = uosEnrolments[0].campus;
        item.campusDescription = uosEnrolments[0].campusDescription;
      }
    }
  }

  parseAcademicMajor(currentCourse: any) {
    if (!currentCourse.pathway) {
      console.log('No pathway inside enrolment details');
    }
    const result: any[] = [];
    for (let i = 0; i < currentCourse.pathway; i++) {
      const pathway = currentCourse.pathway[i];
      if (pathway.pathwayCode && pathway.pathwayCode.indexOf('M-') >= 0) {
        // TODO: need to check this against real data, unable to validate propert names
        result.push(pathway.pathwayDescription);
      }
    }
    return result.join(' ');
  }
}
