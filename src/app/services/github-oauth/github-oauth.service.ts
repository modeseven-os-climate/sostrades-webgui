import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataHttpService } from '../http/data-http/data-http.service';

@Injectable({
  providedIn: 'root'
})
export class GithubOAuthService extends DataHttpService {

  constructor(
    private http: HttpClient,
    private location: Location) {
      super(location, 'github/oauth');
   }

  getGithubOAuthAvailable(): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiRoute}/available`);
  }

  getGithubOAuthUrl(redirectUri : string): Observable<string> {
    if(redirectUri !== null && redirectUri !== undefined) {
      const payload = { redirect_uri: redirectUri }; 
      return this.http.post<string>(`${this.apiRoute}/authorize`, payload).pipe(map(
        response => {
          return response;
        }
        ));
    } 
  }
  // getGithubOAuthUrl(): Observable<string> {
  //   return this.http.get<string>(`${this.apiRoute}/authorize`);
  // } 
}
