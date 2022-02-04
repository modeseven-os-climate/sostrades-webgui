import { Study, PostStudy, LoadedStudy } from 'src/app/models/study.model';
import { Injectable, EventEmitter } from '@angular/core';
import { map } from 'rxjs/operators';
import { HttpClient, HttpHeaders, HttpEvent, HttpParams } from '@angular/common/http';
import { NodeData, IoType } from 'src/app/models/node-data.model';
import { Observable, Subscriber } from 'rxjs';
import { IconMapping } from 'src/app/models/icon-mapping.model';
import { Router } from '@angular/router';
import { StudyUpdateParameter, UpdateParameterType } from 'src/app/models/study-update.model';
import { Location } from '@angular/common';
import { CoeditionNotification } from 'src/app/models/coedition-notification.model';
import { TypeConversionTools } from 'src/app/tools/type-conversion.tool';
import { UserStudyPreferences } from 'src/app/models/user-study-preferences.model';
import { Scenario } from 'src/app/models/scenario.model';
import { StudyCaseValidationService } from '../../study-case-validation/study-case-validation.service';
import { DataHttpService } from '../../http/data-http/data-http.service';
import { OntologyService } from '../../ontology/ontology.service';

@Injectable({
  providedIn: 'root'
})
export class StudyCaseDataService extends DataHttpService {

  onStudyCaseChange: EventEmitter<LoadedStudy> = new EventEmitter();
  onSearchVariableChange: EventEmitter<string> = new EventEmitter();
  onTradeSpaceSelectionChanged: EventEmitter<boolean> = new EventEmitter<boolean>();
  onTreeNodeNavigation: EventEmitter<NodeData> = new EventEmitter<NodeData>();

  public tradeScenarioList: Scenario[];

  public loadedStudy: LoadedStudy;
  public iconMapping: IconMapping;

  public studyManagementData: Study[];
  public studyManagementFilter: string;
  public studyManagementColumnFiltered: string;

  public dataSearchResults: NodeData[];
  public dataSearchInput: string

  constructor(
    private http: HttpClient,
    private router: Router,
    private studyCaseValidationService: StudyCaseValidationService,
    private ontologyService: OntologyService,
    private location: Location) {
    super(location, 'study-case');
    this.loadedStudy = null;
    this.iconMapping = null;

    this.studyManagementData = [];
    this.studyManagementFilter = '';
    this.studyManagementColumnFiltered = 'All columns';

    this.tradeScenarioList = [];
    this.dataSearchResults = [];
    this.dataSearchInput = '';
  }

  clearCache() {
    this.loadedStudy = null;
    this.studyManagementData = [];
    this.studyManagementFilter = '';
    this.studyManagementColumnFiltered = 'All columns';
    this.tradeScenarioList = [];
    this.dataSearchResults = [];
    this.dataSearchInput = '';
  }

  /// -----------------------------------------------------------------------------------------------------------------------------
  /// --------------------------------------           API DATA          ----------------------------------------------------------
  /// -----------------------------------------------------------------------------------------------------------------------------

  getStudies(): Observable<Study[]> {
    return this.http.get<Study[]>(this.apiRoute).pipe(map(
      response => {
        const studies: Study[] = [];
        response.forEach(study => {
          studies.push(Study.Create(study));
        });
        return studies;
      }));
  }

  getStudyNotifications(studyId: number): Observable<CoeditionNotification[]> {
    const url = `${this.apiRoute}/${studyId}/notifications`;
    return this.http.get<CoeditionNotification[]>(url).pipe(map(
      response => {
        const notifications: CoeditionNotification[] = [];
        response.forEach(notif => {
          notifications.push(CoeditionNotification.Create(notif));
        });
        return notifications;
      }));
  }

  getAuthorizedStudiesForProcess(process, repository): Observable<Study[]> {
    const url = `${this.apiRoute}/process`;

    const request = {
      process_name: process,
      repository_name: repository
    };

    return this.http.post<Study[]>(url, request, this.options).pipe(map(
      response => {
        const studies: Study[] = [];
        response.forEach(study => {
          studies.push(Study.Create(study));
        });
        return studies;
      }));
  }

  getDisciplineIconMapping(): Observable<void> {
    return this.http.get<IconMapping>(`${this.apiRoute}/icon-mapping`).pipe(map(
      response => {
        this.iconMapping = IconMapping.Create(response);
      }, error => {
        this.iconMapping = new IconMapping();
      }));
  }

  getChangeFile(parameterKey: string, notificationId: number): Observable<ArrayBuffer> {

    const options: {
      headers?: HttpHeaders;
      observe?: 'body';
      params?: HttpParams;
      reportProgress?: boolean;
      responseType: 'arraybuffer';
    } = {
      responseType: 'arraybuffer'
    };
    const url = `${this.apiRoute}/${this.loadedStudy.studyCase.id}/parameter/change`;
    const data = {
      parameter_key: parameterKey,
      notification_id: notificationId
    };

    return this.http.post(url, data, options);
  }

  getHasStudyCaseAccessRight(studyID: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiRoute}/${studyID}/access`).pipe(map(
      response => {
        return response;
      }));
  }

  getStudyLogs(studyid): Observable<Blob> {

    const options: {
      headers?: HttpHeaders;
      observe?: 'body';
      params?: HttpParams;
      reportProgress?: boolean;
      responseType: 'blob';
    } = {
      responseType: 'blob'
    };
    const url = `${this.apiRoute}/logs/download`;
    const data = {
      studyid: studyid
    };

    return this.http.post(url, data, options);
  }

  getRawStudyLogs(studyid): Observable<Blob> {

    const options: {
      headers?: HttpHeaders;
      observe?: 'body';
      params?: HttpParams;
      reportProgress?: boolean;
      responseType: 'blob';
    } = {
      responseType: 'blob'
    };
    const url = `${this.apiRoute}/raw-logs/download`;
    const data = {
      studyid: studyid
    };

    return this.http.post(url, data, options);
  }

  SetUserStudyPreference(TreeNodeOrPanelId: string, isExpanded: boolean): Observable<any> {
    this.loadedStudy.userStudyPreferences.treeNodeExpandedData[TreeNodeOrPanelId] = isExpanded;
    return this.SaveUserStudyPreferences(this.loadedStudy.studyCase.id, this.loadedStudy.userStudyPreferences);
  }

  GetUserStudyPreference(TreeNodeOrPanelId: string, defaultValue: boolean): boolean {
    if (this.loadedStudy.userStudyPreferences !== undefined) {
      if (this.loadedStudy.userStudyPreferences.treeNodeExpandedData[TreeNodeOrPanelId] !== undefined) {
        return this.loadedStudy.userStudyPreferences.treeNodeExpandedData[TreeNodeOrPanelId];
      }
    }
    return defaultValue;
  }

  private SaveUserStudyPreferences(studyID: number, userStudyPreferences: UserStudyPreferences): Observable<any> {

    const request = {
      preference: userStudyPreferences.treeNodeExpandedData,
    };
    return this.http.post(`${this.apiRoute}/${studyID}/preference`, request);
  }

  claimStudyExecutionRight(): Observable<any> {
    return this.http.post<any>(`${this.apiRoute}/${this.loadedStudy.studyCase.id}/user/execution`, null);
  }

  dataSearch(inputToSearch: string, showEditable: boolean, userLevel: number){
    //search a text in data names or ontology names and display search panel

    
      this.dataSearchInput = inputToSearch;
      this.dataSearchResults = [];
      // search an inpupt into all data names
      Object.values(this.loadedStudy.treeview.rootNodeDataDict).forEach(nodeData => {
        let label = '';
        if (this.ontologyService.getParameter(nodeData.displayName)){
          label = this.ontologyService.getParameter(nodeData.displayName).label;
        }
        if (nodeData.displayName.toLowerCase().includes(inputToSearch.toLowerCase()) ||
        label.toLowerCase().includes(inputToSearch.toLowerCase()))
        {
          if((nodeData.ioType === IoType.OUT || showEditable || (!showEditable && nodeData.editable)) &&
          (nodeData.userLevel <= userLevel)){
            this.dataSearchResults.push(nodeData);
          }
        }
      });
    
    this.onSearchVariableChange.emit(inputToSearch);
  }

  resetSearch(){
    this.dataSearchInput = "";
    this.dataSearchResults = [];
  }


}